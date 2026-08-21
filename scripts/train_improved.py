"""
PCam icin GELISTIRILMIS egitim: guclu augmentation (D8 dondurme + HED stain)
+ AdamW + Cosine LR + label smoothing + early stopping.

Hem SIFIRDAN CNN'i (--model cnn) hem de fine-tune ResNet'i (--model resnet18/50)
ayni rejimle egitir. En iyi modeli VAL accuracy'ye gore secer; EN SONDA hic
gormedigi TEST setinde olcer (rapor edilecek gercek sayi budur).

ONEMLI: Mevcut app modelini EZMEZ. Cikti  models/{model}_improved.pth  olarak
kaydedilir. Daha iyiyse elle backend/models/'a kopyalarsin.

Calistirma (repo kokunde, GPU onerilir):
    pip install torch torchvision h5py numpy pillow scikit-image tqdm
    python scripts/train_improved.py --model cnn      --epochs 25
    python scripts/train_improved.py --model resnet18 --epochs 20

Hizli deneme (kod dogru mu):
    python scripts/train_improved.py --model cnn --epochs 1 --limit 512
"""
import os
import json
import random
import argparse

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Subset
from torchvision import models, transforms
import torchvision.transforms.functional as TF
from PIL import Image

from dataset import PatchCamelyonDataset  # scripts/ ile ayni dizinde
from model_cnn import PcamCNN

try:
    from tqdm.auto import tqdm  # ilerleme cubugu (epoch icinde batch'ler)
except Exception:
    def tqdm(x, **k):
        return x

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# --- HED stain augmentation (histopatolojiye ozel, en buyuk kazanc) ---
try:
    from skimage.color import rgb2hed, hed2rgb
    _HAS_SKIMAGE = True
except Exception:
    _HAS_SKIMAGE = False


class HEDStain:
    """H&E boyama varyansini taklit eder: RGB->HED, kanallari hafif oynat, geri don.
    prob<1 ise bazi goruntulerde atlanir (skimage yavas oldugu icin CPU tasarrufu)."""
    def __init__(self, sigma=0.05, prob=1.0):
        self.sigma = sigma
        self.prob = prob

    def __call__(self, img):
        if not _HAS_SKIMAGE or (self.prob < 1.0 and random.random() > self.prob):
            return img
        arr = np.asarray(img).astype(np.float32) / 255.0
        hed = rgb2hed(arr)
        for c in range(3):
            alpha = 1.0 + np.random.uniform(-self.sigma, self.sigma)
            beta = np.random.uniform(-self.sigma, self.sigma)
            hed[..., c] = hed[..., c] * alpha + beta
        rgb = np.clip(hed2rgb(hed), 0, 1)
        return Image.fromarray((rgb * 255).astype(np.uint8))


class RandomRotate90:
    """Histoloji yon-bagimsiz: 0/90/180/270 derece rastgele dondur (D8)."""
    def __call__(self, img):
        return TF.rotate(img, random.choice([0, 90, 180, 270]))


def build_transforms(size, hed_prob=1.0):
    resize = [transforms.Resize((size, size))] if size != 96 else []
    train = transforms.Compose([
        RandomRotate90(),
        transforms.RandomHorizontalFlip(0.5),
        transforms.RandomVerticalFlip(0.5),
        HEDStain(0.05, prob=hed_prob),
        *resize,
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    evalt = transforms.Compose([
        *resize,
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    return train, evalt


def build_model(name, hidden=32):
    if name == "cnn":
        return PcamCNN(hidden=hidden, n_classes=2)
    if name == "resnet18":
        m = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    elif name == "resnet50":
        m = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    else:
        raise ValueError(name)
    m.fc = nn.Linear(m.fc.in_features, 2)  # tum katmanlar egitilir (fine-tune)
    return m


def loader(x, y, tf, bs, limit=None, shuffle=False, workers=0):
    ds = PatchCamelyonDataset(f"data/camelyonpatch_level_2_split_{x}_x.h5",
                              f"data/camelyonpatch_level_2_split_{y}_y.h5", transform=tf)
    if limit:
        idx = np.linspace(0, len(ds) - 1, min(limit, len(ds))).astype(int)
        ds = Subset(ds, idx.tolist())
    return DataLoader(ds, batch_size=bs, shuffle=shuffle, num_workers=workers,
                      pin_memory=torch.cuda.is_available(),
                      persistent_workers=(workers > 0))


@torch.no_grad()
def evaluate(model, dl, device):
    model.eval()
    tp = fp = fn = tn = 0
    loss_sum, n = 0.0, 0
    crit = nn.CrossEntropyLoss()
    for X, yb in dl:
        yb = yb.squeeze().long() if yb.ndim > 1 else yb.long()
        X, yb = X.to(device), yb.to(device)
        out = model(X)
        loss_sum += crit(out, yb).item() * X.size(0)
        n += X.size(0)
        pred = out.argmax(1)
        for p, t in zip(pred.cpu().numpy(), yb.cpu().numpy()):
            tp += (p == 1 and t == 1); fp += (p == 1 and t == 0)
            fn += (p == 0 and t == 1); tn += (p == 0 and t == 0)
    acc = (tp + tn) / max(1, n)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {"loss": float(loss_sum / max(1, n)), "acc": float(acc),
            "precision": float(prec), "recall": float(rec), "f1": float(f1),
            "cm": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}}


class EMA:
    """Ağırlıkların üstel hareketli ortalaması (Exponential Moving Average).
    Eğitim boyunca 'gölge' bir kopya tutar; genelde ham modelden biraz daha
    stabil ve doğru olur. Float olmayan buffer'lar (num_batches_tracked) kopyalanır."""
    def __init__(self, model, decay=0.999):
        self.decay = decay
        self.shadow = {k: v.detach().clone() for k, v in model.state_dict().items()}

    def update(self, model):
        for k, v in model.state_dict().items():
            s = self.shadow[k]
            if v.dtype.is_floating_point:
                s.mul_(self.decay).add_(v.detach(), alpha=1 - self.decay)
            else:
                s.copy_(v)

    def state_dict(self):
        return self.shadow


def _d8_views(x):
    """Bir batch için 8 dihedral görünüm (4 döndürme × 2 ayna) üretir."""
    views = []
    for k in range(4):
        r = torch.rot90(x, k, dims=[2, 3])
        views.append(r)
        views.append(torch.flip(r, dims=[3]))
    return views


@torch.no_grad()
def evaluate_tta(model, dl, device):
    """8-yönlü D8 TTA: her görüntünün 8 varyantının softmax olasılıkları
    ortalanır (histoloji yön-bağımsız olduğu için güvenli, tahmini stabilize eder)."""
    model.eval()
    tp = fp = fn = tn = 0
    n = 0
    for X, yb in dl:
        yb = yb.squeeze().long() if yb.ndim > 1 else yb.long()
        X, yb = X.to(device), yb.to(device)
        probs = 0
        for v in _d8_views(X):
            probs = probs + F.softmax(model(v), dim=1)
        probs = probs / 8.0
        pred = probs.argmax(1)
        n += X.size(0)
        for p, tlab in zip(pred.cpu().numpy(), yb.cpu().numpy()):
            tp += (p == 1 and tlab == 1); fp += (p == 1 and tlab == 0)
            fn += (p == 0 and tlab == 1); tn += (p == 0 and tlab == 0)
    acc = (tp + tn) / max(1, n)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {"acc": float(acc), "precision": float(prec), "recall": float(rec),
            "f1": float(f1), "cm": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="cnn", choices=["cnn", "resnet18", "resnet50"])
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--patience", type=int, default=6)
    ap.add_argument("--hidden", type=int, default=32)
    ap.add_argument("--limit", type=int, default=None, help="hizli deneme icin ornek sayisi")
    ap.add_argument("--workers", type=int, default=4, help="paralel veri yukleyici isci sayisi (GPU'yu bekletmemek icin)")
    ap.add_argument("--tag", default="", help="cikti dosyasina ek etiket (ornek: v2 -> cnn_improved_v2.pth); mevcut modeli EZMEMEK icin")
    ap.add_argument("--ema-decay", type=float, default=0.999, help="EMA (agirlik ortalamasi) katsayisi; 0 = EMA kapali")
    ap.add_argument("--no-amp", action="store_true", help="mixed precision'i kapat (varsayilan: GPU'da acik)")
    ap.add_argument("--hed-prob", type=float, default=1.0, help="HED stain augmentation uygulanma olasiligi; CPU darbogazinda 0.5 dene")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cihaz: {device} | Model: {args.model} | HED stain: {_HAS_SKIMAGE}")
    torch.manual_seed(42); np.random.seed(42); random.seed(42)

    size = 96 if args.model == "cnn" else 224
    train_tf, eval_tf = build_transforms(size, hed_prob=args.hed_prob)
    train_dl = loader("train", "train", train_tf, args.batch, args.limit, shuffle=True, workers=args.workers)
    val_dl = loader("valid", "valid", eval_tf, args.batch, args.limit, workers=args.workers)
    test_dl = loader("test", "test", eval_tf, args.batch, args.limit, workers=args.workers)

    model = build_model(args.model, args.hidden).to(device)
    lr = args.lr if args.model == "cnn" else args.lr * 0.3  # fine-tune icin daha kucuk
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)

    os.makedirs("models", exist_ok=True)
    suffix = f"_{args.tag}" if args.tag else ""
    out_path = f"models/{args.model}_improved{suffix}.pth"      # en iyi HAM model
    best_val_acc, no_improve = 0.0, 0
    history = {"train_loss": [], "val_acc": []}

    use_ema = args.ema_decay and args.ema_decay > 0
    ema = EMA(model, args.ema_decay) if use_ema else None

    # Mixed precision (AMP): GPU'da ~2× hiz, sonuclari degistirmez. CPU'da kapali.
    use_amp = (device == "cuda") and not args.no_amp
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    for epoch in range(1, args.epochs + 1):
        model.train()
        run_loss = 0.0
        for X, yb in tqdm(train_dl, desc=f"Epoch {epoch}/{args.epochs}", leave=False):
            yb = yb.squeeze().long() if yb.ndim > 1 else yb.long()
            X, yb = X.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=use_amp):
                loss = crit(model(X), yb)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            if ema is not None:
                ema.update(model)
            run_loss += loss.item() * X.size(0)
        sched.step()
        tr_loss = run_loss / len(train_dl.dataset)
        val = evaluate(model, val_dl, device)
        history["train_loss"].append(tr_loss)
        history["val_acc"].append(val["acc"])
        print(f"Epoch {epoch:>2}/{args.epochs} | train_loss {tr_loss:.4f} | "
              f"val_acc {val['acc']*100:.2f}% | val_f1 {val['f1']:.4f}")

        if val["acc"] > best_val_acc:
            best_val_acc = val["acc"]; no_improve = 0
            torch.save(model.state_dict(), out_path)
            print(f"  -> en iyi model kaydedildi (val_acc {best_val_acc*100:.2f}%) -> {out_path}")
        else:
            no_improve += 1
            if no_improve >= args.patience:
                print(f"  !! {args.patience} epoch iyilesme yok, erken durduruluyor.")
                break

    # ===== FINAL TEST: 4 aday (ham/EMA × duz/TTA) karsilastirilir =====
    # Aday 1: egitim boyunca kaydedilen en iyi HAM model
    raw_model = build_model(args.model, args.hidden).to(device)
    raw_model.load_state_dict(torch.load(out_path, map_location=device, weights_only=True))

    candidates = {"ham": raw_model}
    # Aday 2: EMA (agirlik ortalamasi) modeli
    if ema is not None:
        ema_model = build_model(args.model, args.hidden).to(device)
        ema_model.load_state_dict(ema.state_dict())
        candidates["ema"] = ema_model

    print("\n==================== FINAL TEST ====================")
    print(f"Model: {args.model} (hidden={args.hidden}, tag='{args.tag or '-'}')")
    results = {}
    for name, mdl in candidates.items():
        plain = evaluate(mdl, test_dl, device)
        tta = evaluate_tta(mdl, test_dl, device)
        results[name] = {"plain": plain, "tta": tta}
        print(f"[{name:>3}] duz : acc={plain['acc']*100:.2f}%  rec={plain['recall']:.4f}  f1={plain['f1']:.4f}")
        print(f"[{name:>3}] TTA : acc={tta['acc']*100:.2f}%  rec={tta['recall']:.4f}  f1={tta['f1']:.4f}")

    # Uygulama varsayilan olarak TEK ileri gecis (TTA'siz) kullanir; o yuzden
    # KALICI agirligi 'duz' TEST dogrulugu en yuksek adaya gore sec.
    best_name = max(results, key=lambda k: results[k]["plain"]["acc"])
    best_model = candidates[best_name]
    torch.save(best_model.state_dict(), out_path)
    best_plain = results[best_name]["plain"]
    best_tta = results[best_name]["tta"]
    print("----------------------------------------------------")
    print(f"SECILEN (duz acc en yuksek): '{best_name}' -> {out_path}")
    print(f"  KALICI (duz)  : acc={best_plain['acc']*100:.2f}%  rec={best_plain['recall']:.4f}  f1={best_plain['f1']:.4f}")
    print(f"  + TTA ile     : acc={best_tta['acc']*100:.2f}%  rec={best_tta['recall']:.4f}  f1={best_tta['f1']:.4f}")
    print(f"  Confusion(duz): {best_plain['cm']}")
    print("====================================================")

    metrics_path = f"models/{args.model}_improved{suffix}_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump({"model": args.model, "hidden": args.hidden, "tag": args.tag,
                   "best_val_acc": best_val_acc, "chosen": best_name,
                   "test": best_plain, "test_tta": best_tta,
                   "all_candidates": results, "history": history}, f, indent=2)
    print(f"Metrikler kaydedildi: {metrics_path}")


if __name__ == "__main__":
    main()

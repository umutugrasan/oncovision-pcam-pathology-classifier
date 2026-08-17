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
from torch.utils.data import DataLoader, Subset
from torchvision import models, transforms
import torchvision.transforms.functional as TF
from PIL import Image

from dataset import PatchCamelyonDataset  # scripts/ ile ayni dizinde
from model_cnn import PcamCNN

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# --- HED stain augmentation (histopatolojiye ozel, en buyuk kazanc) ---
try:
    from skimage.color import rgb2hed, hed2rgb
    _HAS_SKIMAGE = True
except Exception:
    _HAS_SKIMAGE = False


class HEDStain:
    """H&E boyama varyansini taklit eder: RGB->HED, kanallari hafif oynat, geri don."""
    def __init__(self, sigma=0.05):
        self.sigma = sigma

    def __call__(self, img):
        if not _HAS_SKIMAGE:
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


def build_transforms(size):
    resize = [transforms.Resize((size, size))] if size != 96 else []
    train = transforms.Compose([
        RandomRotate90(),
        transforms.RandomHorizontalFlip(0.5),
        transforms.RandomVerticalFlip(0.5),
        HEDStain(0.05),
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


def loader(x, y, tf, bs, limit=None, shuffle=False):
    ds = PatchCamelyonDataset(f"data/camelyonpatch_level_2_split_{x}_x.h5",
                              f"data/camelyonpatch_level_2_split_{y}_y.h5", transform=tf)
    if limit:
        idx = np.linspace(0, len(ds) - 1, min(limit, len(ds))).astype(int)
        ds = Subset(ds, idx.tolist())
    return DataLoader(ds, batch_size=bs, shuffle=shuffle, num_workers=0)


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="cnn", choices=["cnn", "resnet18", "resnet50"])
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--patience", type=int, default=6)
    ap.add_argument("--hidden", type=int, default=32)
    ap.add_argument("--limit", type=int, default=None, help="hizli deneme icin ornek sayisi")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cihaz: {device} | Model: {args.model} | HED stain: {_HAS_SKIMAGE}")
    torch.manual_seed(42); np.random.seed(42); random.seed(42)

    size = 96 if args.model == "cnn" else 224
    train_tf, eval_tf = build_transforms(size)
    train_dl = loader("train", "train", train_tf, args.batch, args.limit, shuffle=True)
    val_dl = loader("valid", "valid", eval_tf, args.batch, args.limit)
    test_dl = loader("test", "test", eval_tf, args.batch, args.limit)

    model = build_model(args.model, args.hidden).to(device)
    lr = args.lr if args.model == "cnn" else args.lr * 0.3  # fine-tune icin daha kucuk
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)

    os.makedirs("models", exist_ok=True)
    out_path = f"models/{args.model}_improved.pth"
    best_val_acc, no_improve = 0.0, 0
    history = {"train_loss": [], "val_acc": []}

    for epoch in range(1, args.epochs + 1):
        model.train()
        run_loss = 0.0
        for X, yb in train_dl:
            yb = yb.squeeze().long() if yb.ndim > 1 else yb.long()
            X, yb = X.to(device), yb.to(device)
            opt.zero_grad()
            loss = crit(model(X), yb)
            loss.backward()
            opt.step()
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

    # FINAL TEST (en iyi model)
    model.load_state_dict(torch.load(out_path, map_location=device, weights_only=True))
    test = evaluate(model, test_dl, device)
    print("\n==================== FINAL TEST ====================")
    print(f"Model: {args.model}")
    print(f"TEST acc={test['acc']*100:.2f}%  precision={test['precision']:.4f}  "
          f"recall={test['recall']:.4f}  f1={test['f1']:.4f}")
    print(f"Confusion: {test['cm']}")
    print("====================================================")

    with open(f"models/{args.model}_improved_metrics.json", "w") as f:
        json.dump({"model": args.model, "best_val_acc": best_val_acc,
                   "test": test, "history": history}, f, indent=2)
    print(f"Metrikler kaydedildi: models/{args.model}_improved_metrics.json")


if __name__ == "__main__":
    main()

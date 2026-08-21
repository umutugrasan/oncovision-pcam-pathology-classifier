"""
Test seti uzerinde her model icin performans metriklerini hesaplar ve
frontend/public/metrics.json'a yazar. Performans sayfasi bu dosyayi okur.

Uretilen metrikler (model basina):
  - confusion matrix (esik 0.5, kalibre olasiliklar)
  - accuracy / precision / recall / f1
  - ROC egrisi (+ AUC)
  - precision-recall egrisi (+ AP)
  - reliability (kalibrasyon) diyagrami: kalibrasyon oncesi/sonrasi + ECE

Calistirma (backend imajiyla):
  docker run --rm -v "<proje>:/work" -w /work pcam_project-backend \
    sh -c "pip install -q h5py && python compute_metrics.py"
"""
import os
import sys
import json

import h5py
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # scripts/ -> model_cnn
from model_cnn import PcamCNN

DEVICE = torch.device("cpu")
TEST_X = "data/camelyonpatch_level_2_split_test_x.h5"
TEST_Y = "data/camelyonpatch_level_2_split_test_y.h5"
OUT_PATH = "frontend/public/metrics.json"
# Sira ONEMLI: Performans sayfasi ilk modeli varsayilan gosterir -> "cnn" basta.
MODEL_NAMES = ["cnn", "resnet18", "resnet50"]
MAX_SAMPLES = 8000
BATCH = 64
CURVE_POINTS = 60  # ROC/PR egrisi ornek nokta sayisi (JSON kucuk kalsin)

def _trapz(y, x):
    """numpy sürüm uyumluluğu: 2.x'te trapezoid, eskide trapz."""
    fn = getattr(np, "trapezoid", None) or np.trapz
    return fn(y, x)


def transform_for(name):
    size = 96 if name == "cnn" else 224
    return transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])


def build_model(name):
    if name == "cnn":
        return PcamCNN(hidden=32, n_classes=2)
    m = models.resnet18(weights=None) if name == "resnet18" else models.resnet50(weights=None)
    m.fc = nn.Linear(m.fc.in_features, 2)
    return m


def model_weight_path(name):
    return ("backend/models/cnn_improved.pth" if name == "cnn"
            else f"backend/models/{name}_pcam_best.pth")


def load_temperature(name):
    try:
        with open(f"backend/models/{name}_temperature.json") as f:
            return float(json.load(f)["temperature"])
    except Exception:
        return 1.0


def _d8_logits(model, batch):
    """8 dihedral görünümün logit ortalaması (TTA)."""
    out = 0
    for k in range(4):
        r = torch.rot90(batch, k, dims=[2, 3])
        out = out + model(r) + model(torch.flip(r, dims=[3]))
    return out / 8.0


def collect_logits(name, idxs, X, Y, tta=False):
    model = build_model(name)
    model.load_state_dict(torch.load(model_weight_path(name),
                                     map_location=DEVICE, weights_only=True))
    model.eval().to(DEVICE)
    transform = transform_for(name)

    logits_all, labels = [], []
    buff_i, buff_l = [], []
    with torch.no_grad():
        for c, i in enumerate(idxs):
            arr = np.array(X[i]).astype(np.uint8)
            buff_i.append(transform(Image.fromarray(arr, "RGB")))
            buff_l.append(int(np.array(Y[i]).flatten()[0]))
            if len(buff_i) == BATCH or c == len(idxs) - 1:
                b = torch.stack(buff_i).to(DEVICE)
                out = _d8_logits(model, b) if tta else model(b)
                logits_all.append(out.cpu())
                labels.extend(buff_l)
                buff_i, buff_l = [], []
                print(f"  {name}{'(TTA)' if tta else ''}: {c + 1}/{len(idxs)}", end="\r")
    return torch.cat(logits_all), np.array(labels)


def roc_curve(scores, labels, n=CURVE_POINTS):
    thr = np.linspace(0, 1, n)
    P = max(1, labels.sum())
    N = max(1, (labels == 0).sum())
    tpr, fpr = [], []
    for t in thr:
        pred = scores >= t
        tpr.append(float(((pred == 1) & (labels == 1)).sum()) / P)
        fpr.append(float(((pred == 1) & (labels == 0)).sum()) / N)
    # AUC: fpr artan olacak sekilde trapez
    order = np.argsort(fpr)
    auc = float(_trapz(np.array(tpr)[order], np.array(fpr)[order]))
    return [round(x, 4) for x in fpr], [round(x, 4) for x in tpr], round(auc, 4)


def pr_curve(scores, labels, n=CURVE_POINTS):
    thr = np.linspace(0, 1, n)
    rec, prec = [], []
    for t in thr:
        pred = scores >= t
        tp = ((pred == 1) & (labels == 1)).sum()
        fp = ((pred == 1) & (labels == 0)).sum()
        fn = ((pred == 0) & (labels == 1)).sum()
        r = tp / (tp + fn) if (tp + fn) else 0.0
        p = tp / (tp + fp) if (tp + fp) else 1.0
        rec.append(float(r))
        prec.append(float(p))
    ap = float(_trapz(prec[::-1], rec[::-1]))
    return [round(x, 4) for x in rec], [round(x, 4) for x in prec], round(abs(ap), 4)


def reliability(p_tumor, labels, bins=10):
    conf = np.maximum(p_tumor, 1 - p_tumor)
    pred = (p_tumor >= 0.5).astype(int)
    acc_hit = (pred == labels).astype(float)
    accs, confs, counts = [], [], []
    ece = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        m = (conf > lo) & (conf <= hi)
        if m.sum() > 0:
            a, c = float(acc_hit[m].mean()), float(conf[m].mean())
            accs.append(round(a, 4))
            confs.append(round(c, 4))
            counts.append(int(m.sum()))
            ece += (m.sum() / len(conf)) * abs(a - c)
        else:
            accs.append(None)
            confs.append(round((lo + hi) / 2, 4))
            counts.append(0)
    return {"acc": accs, "conf": confs, "count": counts, "ece": round(ece, 4)}


def main():
    fx = h5py.File(TEST_X, "r")
    fy = h5py.File(TEST_Y, "r")
    X, Y = fx["x"], fy["y"]
    n = min(MAX_SAMPLES, X.shape[0])
    idxs = np.linspace(0, X.shape[0] - 1, n).astype(int)

    out = {}
    for name in MODEL_NAMES:
        # Özel CNN uygulamada TTA ile servis edilir -> metrikleri de TTA ile üret
        logits, labels = collect_logits(name, idxs, X, Y, tta=(name == "cnn"))
        T = load_temperature(name)
        p_raw = F.softmax(logits, dim=1)[:, 1].numpy()
        p_cal = F.softmax(logits / T, dim=1)[:, 1].numpy()

        pred = (p_cal >= 0.5).astype(int)
        tp = int(((pred == 1) & (labels == 1)).sum())
        fp = int(((pred == 1) & (labels == 0)).sum())
        fn = int(((pred == 0) & (labels == 1)).sum())
        tn = int(((pred == 0) & (labels == 0)).sum())
        acc = (tp + tn) / len(labels)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0

        fpr, tpr, auc = roc_curve(p_cal, labels)
        pr_r, pr_p, ap = pr_curve(p_cal, labels)

        out[name] = {
            "n": int(n),
            "temperature": round(T, 4),
            "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "roc": {"fpr": fpr, "tpr": tpr, "auc": auc},
            "pr": {"recall": pr_r, "precision": pr_p, "ap": ap},
            "reliability": {
                "before": reliability(p_raw, labels),
                "after": reliability(p_cal, labels),
            },
        }
        print(f"\n{name}: acc={acc:.4f} auc={auc:.4f} "
              f"ECE {out[name]['reliability']['before']['ece']} -> "
              f"{out[name]['reliability']['after']['ece']}")

    fx.close()
    fy.close()
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)
    print(f"-> {OUT_PATH} yazildi.")


if __name__ == "__main__":
    main()

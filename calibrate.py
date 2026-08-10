"""
Temperature Scaling ile model kalibrasyonu (Guo et al. 2017).

Validation seti uzerinde modelin ham logit'lerini toplar, NLL'i minimize eden
en iyi sicaklik degeri T'yi bulur ve backend/models/temperature.json'a yazar.
Inference'ta logit'ler T'ye bolununce softmax cikisi (guven yuzdesi) gerceklesir.

Tahminleri ve accuracy'yi DEGISTIRMEZ; sadece guven yuzdesini dogrular.

Calistirma (proje kokunde, backend imajiyla):
  docker run --rm -v "<proje>:/work" -w /work pcam_project-backend \
    sh -c "pip install -q h5py && python calibrate.py"
"""
import json

import h5py
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

DEVICE = torch.device("cpu")
VAL_X = "data/camelyonpatch_level_2_split_valid_x.h5"
VAL_Y = "data/camelyonpatch_level_2_split_valid_y.h5"
MODEL_PATH = "backend/models/resnet18_pcam_best.pth"
OUT_PATH = "backend/models/temperature.json"
MAX_SAMPLES = 8000   # kalibrasyon icin fazlasiyla yeterli, hiz icin alt kume
BATCH = 64

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def build_model():
    m = models.resnet18(weights=None)
    m.fc = nn.Linear(m.fc.in_features, 2)
    return m


def expected_calibration_error(probs, labels, bins=10):
    """ECE: guven ile gercek isabet arasindaki ortalama fark (0 = mukemmel)."""
    conf, pred = probs.max(dim=1)
    acc = (pred == labels).float()
    ece = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        m = (conf > lo) & (conf <= hi)
        if m.sum() > 0:
            ece += (m.float().mean() * (acc[m].mean() - conf[m].mean()).abs()).item()
    return ece


def main():
    model = build_model()
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True))
    model.eval().to(DEVICE)

    fx = h5py.File(VAL_X, "r")
    fy = h5py.File(VAL_Y, "r")
    X, Y = fx["x"], fy["y"]
    n = min(MAX_SAMPLES, X.shape[0])
    idxs = np.linspace(0, X.shape[0] - 1, n).astype(int)

    logits_all, labels_all = [], []
    buff_imgs, buff_lbls = [], []
    with torch.no_grad():
        for count, i in enumerate(idxs):
            arr = np.array(X[i]).astype(np.uint8)
            buff_imgs.append(transform(Image.fromarray(arr, "RGB")))
            buff_lbls.append(int(np.array(Y[i]).flatten()[0]))
            if len(buff_imgs) == BATCH or count == n - 1:
                t = torch.stack(buff_imgs).to(DEVICE)
                logits_all.append(model(t).cpu())
                labels_all.extend(buff_lbls)
                buff_imgs, buff_lbls = [], []
                print(f"  islenen: {count + 1}/{n}", end="\r")
    fx.close()
    fy.close()

    logits = torch.cat(logits_all)
    labels = torch.tensor(labels_all)

    # En iyi T'yi LBFGS ile bul (NLL minimize)
    T = torch.nn.Parameter(torch.ones(1))
    nll = nn.CrossEntropyLoss()
    opt = torch.optim.LBFGS([T], lr=0.01, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = nll(logits / T, labels)
        loss.backward()
        return loss

    opt.step(closure)
    T_val = float(T.item())

    p_before = F.softmax(logits, dim=1)
    p_after = F.softmax(logits / T_val, dim=1)
    result = {
        "temperature": round(T_val, 4),
        "n_samples": int(n),
        "ece_before": round(expected_calibration_error(p_before, labels), 4),
        "ece_after": round(expected_calibration_error(p_after, labels), 4),
    }
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, indent=2)

    print("\n=== KALIBRASYON SONUCU ===")
    print(json.dumps(result, indent=2))
    print(f"-> {OUT_PATH} yazildi.")


if __name__ == "__main__":
    main()

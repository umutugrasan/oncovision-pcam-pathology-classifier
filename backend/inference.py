"""
Model yükleme, tahmin ve Grad-CAM görselleştirme mantığı.

ÖNEMLİ: Buradaki preprocessing (Resize + Normalize) eğitimdeki
val_transforms ile BİREBİR aynıdır. Farklı olursa model saçmalar.
Kaynak: dataset.py -> val_transforms
"""
import io
import os
import json
import base64

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image, ImageDraw

# ---- Sabitler ----
# Eğitimde: 0 = Sağlıklı, 1 = Kanserli
CLASS_NAMES = {0: "Saglikli", 1: "Kanserli"}
MODEL_PATH = "models/resnet18_pcam_best.pth"
TEMP_PATH = "models/temperature.json"

# Belirsizlik bandı: tümör olasılığı bu aralıktaysa "Belirsiz" (kararsız) sayılır
UNCERTAIN_LOW = 0.40
UNCERTAIN_HIGH = 0.60
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _load_temperature():
    """Kalibrasyon sicakligini (temperature scaling) yukler. Yoksa 1.0 (etkisiz)."""
    try:
        with open(TEMP_PATH) as f:
            return float(json.load(f)["temperature"])
    except (FileNotFoundError, KeyError, ValueError):
        return 1.0


TEMPERATURE = _load_temperature()

# Eğitimdeki val_transforms ile birebir aynı (dataset.py)
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

_model = None  # tek sefer yüklenip bellekte tutulur


def build_model():
    """Eğitimdeki mimariyi (train.py -> build_model) inference için kurar."""
    model = models.resnet18(weights=None)  # ağırlıkları biz yükleyeceğiz
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 2)
    return model


def load_model():
    """Modeli yükler ve bellekte önbelleğe alır."""
    global _model
    if _model is None:
        model = build_model()
        state = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
        model.load_state_dict(state)
        model.to(DEVICE)
        model.eval()
        _model = model
    return _model


def _jet_colormap(x: np.ndarray) -> np.ndarray:
    """0..1 aralığındaki değerleri jet renk haritasına çevirir -> (H, W, 3) 0..255."""
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _compute_gradcam(model, tensor, class_idx):
    """
    layer4 üzerinden Grad-CAM ısı haritası (7x7) üretir, 0..1 normalize eder.
    """
    activations = {}
    gradients = {}

    def fwd_hook(_m, _i, out):
        activations["value"] = out.detach()

    def bwd_hook(_m, _gi, gout):
        gradients["value"] = gout[0].detach()

    h1 = model.layer4.register_forward_hook(fwd_hook)
    h2 = model.layer4.register_full_backward_hook(bwd_hook)

    model.zero_grad()
    logits = model(tensor)
    score = logits[0, class_idx]
    score.backward()

    h1.remove()
    h2.remove()

    acts = activations["value"][0]        # (C, 7, 7)
    grads = gradients["value"][0]         # (C, 7, 7)
    weights = grads.mean(dim=(1, 2))      # (C,)  -> her kanalın önemi
    cam = torch.relu((weights[:, None, None] * acts).sum(dim=0))  # (7, 7)

    cam = cam - cam.min()
    cam = cam / (cam.max() + 1e-8)
    return cam.cpu().numpy(), logits.detach()


def _make_overlay(orig_img: Image.Image, cam: np.ndarray, threshold: float = 0.5) -> str:
    """
    Isı haritasını orijinal görselin üzerine bindirir, en sıcak bölgeyi
    kare içine alır ve base64 PNG (data URI) döndürür.
    """
    W, H = orig_img.size
    base = np.array(orig_img.convert("RGB")).astype(np.float32)

    # CAM'i görsel boyutuna büyüt
    cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    cam_arr = np.array(cam_img).astype(np.float32) / 255.0  # (H, W) 0..1

    heat = _jet_colormap(cam_arr).astype(np.float32)         # (H, W, 3)
    alpha = (cam_arr * 0.6)[..., None]                       # sıcak yer daha opak
    blended = base * (1 - alpha) + heat * alpha
    overlay = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))

    # En sıcak bölgeyi kare içine al
    mask = cam_arr > threshold
    if mask.any():
        ys, xs = np.where(mask)
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
        draw = ImageDraw.Draw(overlay)
        draw.rectangle([x0, y0, x1, y1], outline=(0, 255, 0), width=max(1, W // 48))

    buf = io.BytesIO()
    overlay.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def predict_image(image_bytes: bytes, with_heatmap: bool = True) -> dict:
    """
    Ham görüntü baytlarını alır; tahmin + (isteğe bağlı) Grad-CAM overlay döndürür.
    """
    model = load_model()

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _transform(img).unsqueeze(0).to(DEVICE)  # (1, 3, 224, 224)

    if with_heatmap:
        # Grad-CAM için önce tahmini almalıyız (gradyan gerekir)
        # Kalibrasyon: logit'leri T'ye bölerek güven yüzdesini dürüstleştir
        with torch.no_grad():
            probs0 = F.softmax(model(tensor) / TEMPERATURE, dim=1).squeeze(0)
        pred_idx = int(torch.argmax(probs0).item())
        cam, _ = _compute_gradcam(model, tensor, pred_idx)
        heatmap = _make_overlay(img, cam)
        probs = probs0
    else:
        with torch.no_grad():
            probs = F.softmax(model(tensor) / TEMPERATURE, dim=1).squeeze(0)
        pred_idx = int(torch.argmax(probs).item())
        heatmap = None

    p_healthy = float(probs[0].item())
    p_tumor = float(probs[1].item())

    # Belirsizlik: tümör olasılığı karar sınırına (0.5) yakınsa model kararsızdır.
    # Böyle vakalarda net karar yerine "Belirsiz" deyip uzman incelemesine yönlendiririz.
    uncertain = UNCERTAIN_LOW <= p_tumor <= UNCERTAIN_HIGH

    result = {
        "prediction": CLASS_NAMES[pred_idx],
        "tumor_probability": round(p_tumor, 4),
        "healthy_probability": round(p_healthy, 4),
        "confidence": round(max(p_tumor, p_healthy), 4),
        "uncertain": uncertain,
    }
    if heatmap:
        result["heatmap"] = heatmap
    return result

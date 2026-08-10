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

# Desteklenen modeller: ağırlık dosyaları backend/models/ altında
MODEL_PATHS = {
    "resnet18": "models/resnet18_pcam_best.pth",
    "resnet50": "models/resnet50_pcam_best.pth",
}
DEFAULT_MODEL = "resnet18"

# Belirsizlik bandı: tümör olasılığı bu aralıktaysa "Belirsiz" (kararsız) sayılır
UNCERTAIN_LOW = 0.40
UNCERTAIN_HIGH = 0.60
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _load_temperature(model_name):
    """Modelin kalibrasyon sicakligini yukler. Yoksa 1.0 (etkisiz)."""
    try:
        with open(f"models/{model_name}_temperature.json") as f:
            return float(json.load(f)["temperature"])
    except (FileNotFoundError, KeyError, ValueError):
        return 1.0


# Eğitimdeki val_transforms ile birebir aynı (dataset.py)
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

_cache = {}  # model_name -> (model, temperature)


def build_model(model_name):
    """Eğitimdeki mimariyi (train.py -> build_model) inference için kurar."""
    if model_name == "resnet18":
        model = models.resnet18(weights=None)
    elif model_name == "resnet50":
        model = models.resnet50(weights=None)
    else:
        raise ValueError(f"Bilinmeyen model: {model_name}")
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model


def load_model(model_name=DEFAULT_MODEL):
    """Modeli (ve kalibrasyon sıcaklığını) yükler, bellekte önbelleğe alır."""
    if model_name not in MODEL_PATHS:
        raise ValueError(f"Bilinmeyen model: {model_name}")
    if model_name not in _cache:
        model = build_model(model_name)
        state = torch.load(MODEL_PATHS[model_name], map_location=DEVICE, weights_only=True)
        model.load_state_dict(state)
        model.to(DEVICE)
        model.eval()
        _cache[model_name] = (model, _load_temperature(model_name))
    return _cache[model_name]


def available_models():
    """Ağırlık dosyası diskte mevcut olan modellerin listesi."""
    return [name for name, path in MODEL_PATHS.items() if os.path.exists(path)]


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
    SAYDAM (RGBA) ısı haritası katmanı üretir: sıcak bölge opak, soğuk bölge
    şeffaf. Orijinalin üstüne bindirmez — frontend, bu katmanın opaklığını
    slider ile ayarlar. En sıcak bölge yeşil kare ile işaretlenir.
    """
    W, H = orig_img.size

    # CAM'i görsel boyutuna büyüt
    cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    cam_arr = np.array(cam_img).astype(np.float32) / 255.0  # (H, W) 0..1

    heat = _jet_colormap(cam_arr)                            # (H, W, 3) uint8
    alpha = (cam_arr * 255).astype(np.uint8)[..., None]      # sıcaklık = opaklık
    rgba = np.concatenate([heat, alpha], axis=-1)            # (H, W, 4)
    overlay = Image.fromarray(rgba, mode="RGBA")

    # En sıcak bölgeyi kare içine al (tam opak, hep görünür)
    mask = cam_arr > threshold
    if mask.any():
        ys, xs = np.where(mask)
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
        draw = ImageDraw.Draw(overlay)
        draw.rectangle([x0, y0, x1, y1], outline=(0, 255, 0, 255), width=max(1, W // 48))

    buf = io.BytesIO()
    overlay.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _tta_views(tensor):
    """Görselin 4 varyantı: orijinal + yatay/dikey/180° çevrilmiş.
    Eğitimdeki augmentation (flip + rotation) ile uyumlu, güvenli dönüşümler."""
    return torch.cat([
        tensor,                             # orijinal
        torch.flip(tensor, dims=[3]),       # yatay çevir
        torch.flip(tensor, dims=[2]),       # dikey çevir
        torch.flip(tensor, dims=[2, 3]),    # 180° döndür
    ], dim=0)


def predict_image(image_bytes: bytes, model_name: str = DEFAULT_MODEL,
                  with_heatmap: bool = True, tta: bool = False) -> dict:
    """
    Ham görüntü baytlarını alır; tahmin + (isteğe bağlı) Grad-CAM overlay döndürür.
    tta=True ise 4 varyantın olasılıkları ortalanarak daha kararlı tahmin üretilir.
    """
    model, temperature = load_model(model_name)

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _transform(img).unsqueeze(0).to(DEVICE)  # (1, 3, 224, 224)

    # Kalibrasyon: logit'leri T'ye bölerek güven yüzdesini dürüstleştir
    with torch.no_grad():
        if tta:
            probs_each = F.softmax(model(_tta_views(tensor)) / temperature, dim=1)
            probs = probs_each.mean(dim=0)  # 4 varyantın ortalaması
        else:
            probs = F.softmax(model(tensor) / temperature, dim=1).squeeze(0)
    pred_idx = int(torch.argmax(probs).item())

    # Grad-CAM her zaman orijinal yönelim üzerinden hesaplanır
    heatmap = None
    if with_heatmap:
        cam, _ = _compute_gradcam(model, tensor, pred_idx)
        heatmap = _make_overlay(img, cam)

    p_healthy = float(probs[0].item())
    p_tumor = float(probs[1].item())

    # Belirsizlik: tümör olasılığı karar sınırına (0.5) yakınsa model kararsızdır.
    uncertain = UNCERTAIN_LOW <= p_tumor <= UNCERTAIN_HIGH

    result = {
        "model": model_name,
        "prediction": CLASS_NAMES[pred_idx],
        "tumor_probability": round(p_tumor, 4),
        "healthy_probability": round(p_healthy, 4),
        "confidence": round(max(p_tumor, p_healthy), 4),
        "uncertain": uncertain,
        "tta": tta,
    }
    if heatmap:
        result["heatmap"] = heatmap
    return result

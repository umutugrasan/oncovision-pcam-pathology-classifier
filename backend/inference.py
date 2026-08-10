"""
Model yükleme ve tahmin mantığı.

ÖNEMLİ: Buradaki preprocessing (Resize + Normalize) eğitimdeki
val_transforms ile BİREBİR aynıdır. Farklı olursa model saçmalar.
Kaynak: dataset.py -> val_transforms
"""
import io
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

# ---- Sabitler ----
# Eğitimde: 0 = Sağlıklı, 1 = Kanserli
CLASS_NAMES = {0: "Saglikli", 1: "Kanserli"}
MODEL_PATH = "models/resnet18_pcam_best.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

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


def predict_image(image_bytes: bytes) -> dict:
    """
    Ham görüntü baytlarını alır, tahmin sözlüğü döndürür.
    """
    model = load_model()

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _transform(img).unsqueeze(0).to(DEVICE)  # (1, 3, 224, 224)

    with torch.no_grad():
        logits = model(tensor)
        probs = F.softmax(logits, dim=1).squeeze(0)  # (2,)

    p_healthy = float(probs[0].item())
    p_tumor = float(probs[1].item())
    pred_idx = 1 if p_tumor >= p_healthy else 0

    return {
        "prediction": CLASS_NAMES[pred_idx],
        "tumor_probability": round(p_tumor, 4),
        "healthy_probability": round(p_healthy, 4),
        "confidence": round(max(p_tumor, p_healthy), 4),
    }

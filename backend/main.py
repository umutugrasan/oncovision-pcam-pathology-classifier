"""
PCam Patoloji Sınıflandırma API'si (FastAPI).

NOT: Bu araç ARAŞTIRMA/EĞİTİM amaçlıdır. Klinik tanı için kullanılamaz.
Model yalnızca H&E boyalı lenf düğümü patch'leri (PCam) için anlamlıdır.
"""
import os

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from inference import predict_image, load_model, available_models, MODEL_PATHS

app = FastAPI(
    title="PCam Patoloji Sınıflandırma API",
    description="ResNet18 tabanlı metastatik meme kanseri (lenf düğümü) patch sınıflandırıcı",
    version="1.0.0",
)

# React geliştirme sunucusu farklı porttan gelir; CORS açıyoruz.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # üretimde kendi domaininle sınırla
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/tiff", "image/bmp"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@app.on_event("startup")
def _warmup():
    # Varsayılan modeli açılışta yükle (ilk tahmin gecikmesini önler)
    load_model()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/models")
def models_list():
    """Kullanılabilir modelleri döndürür (frontend seçici için)."""
    return {"models": available_models()}


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    model: str = Form("resnet18"),
    tta: bool = Form(False),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya tipi: {file.content_type}. "
                   "PNG/JPG/TIFF yükleyin.",
        )
    if model not in MODEL_PATHS:
        raise HTTPException(status_code=400, detail=f"Bilinmeyen model: {model}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya 10 MB'tan büyük.")
    if not data:
        raise HTTPException(status_code=400, detail="Boş dosya.")

    try:
        result = predict_image(data, model_name=model, tta=tta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tahmin hatası: {e}")

    result["filename"] = file.filename
    return result


# --- Statik frontend servisi (tek-servis deploy, örn. Hugging Face Spaces) ---
# STATIC_DIR mevcutsa derlenmiş React arayüzü de bu backend'den servis edilir.
# API rotaları yukarıda tanımlı olduğu için önce onlar eşleşir; alttaki catch-all
# yalnızca statik dosyaları ve SPA yönlendirmesini (index.html) karşılar.
STATIC_DIR = os.environ.get("STATIC_DIR", "static")
if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

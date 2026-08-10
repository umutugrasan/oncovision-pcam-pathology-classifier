# Hugging Face Spaces (Docker) için birleşik imaj:
# frontend'i derler, FastAPI backend hem API'yi hem statik arayüzü 7860'ta servis eder.

# --- Aşama 1: React arayüzünü derle (tek-servis: API_BASE boş = aynı origin) ---
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV VITE_API_BASE=""
RUN npm run build

# --- Aşama 2: backend + statik arayüz ---
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo libpng16-16 curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend kodu (büyük .pth ağırlıkları .dockerignore ile hariç; aşağıda indirilir)
COPY backend/ ./

# Model ağırlıklarını GitHub'dan indir (HF Space repo'su küçük kalsın, git-lfs gerekmesin).
# Farklı bir repo/branch için --build-arg MODEL_BASE_URL=... ver.
ARG MODEL_BASE_URL=https://raw.githubusercontent.com/umutugrasan/pcam-pathology-classifier/main/backend/models
RUN curl -fSL "${MODEL_BASE_URL}/resnet18_pcam_best.pth" -o models/resnet18_pcam_best.pth \
    && curl -fSL "${MODEL_BASE_URL}/resnet50_pcam_best.pth" -o models/resnet50_pcam_best.pth

# Derlenmiş arayüz -> static/
COPY --from=frontend /fe/dist ./static

ENV STATIC_DIR=static
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]

FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları (Pillow için gerekli olabilecek minimal kütüphaneler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

# Torch'u CPU-only olarak kur (CUDA çekmesin, imaj küçük kalsın)
RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Kalan bağımlılıklar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodu ve model
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

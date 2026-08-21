# 🔬 OncoVision — PCam Patoloji Sınıflandırıcı

PatchCamelyon (PCam) veri seti üzerinde eğitilmiş modelleri modern bir web
arayüzü üzerinden servis eden uygulama. Varsayılan ve **en iyi model, bu proje
için sıfırdan tasarlanıp eğitilen özel bir CNN**'dir (TEST'te **%90.3 doğruluk /
0.86 recall**, 8-yönlü TTA ile); karşılaştırma için ResNet18 ve ResNet50 (transfer learning) de
seçilebilir. Kullanıcı bir patoloji görseli yükler; model **kanserli / sağlıklı**
tahmini, güven skoru ve **Grad-CAM** dikkat haritası döndürür.

> ⚠️ **Yasal Uyarı:** Bu proje yalnızca **araştırma ve eğitim** amaçlıdır,
> **klinik tanı için kullanılamaz**. Model yalnızca H&E boyalı lenf düğümü
> patch'leri (PCam formatı, 96×96) için anlamlıdır.

---

## ✨ Özellikler

- **Tahmin + olasılık skoru** — sürükle-bırak ile görsel yükle, anında sonuç
- **Grad-CAM ısı haritası** — modelin odaklandığı bölge (yeşil kare) + ayarlanabilir şeffaflık
- **Güven kalibrasyonu (temperature scaling)** — dürüst güven yüzdesi (ECE ↓)
- **Belirsizlik uyarısı** — karar sınırındaki vakalarda "Belirsiz, uzman incelemesi gerekli"
- **Ayarlanabilir karar eşiği** — recall/precision dengesini slider ile canlı ayarla
- **Model seçimi** — Özel CNN (varsayılan, en iyi) ↔ ResNet18 ↔ ResNet50 karşılaştırma
- **Test-time augmentation (TTA)** — 8-yönlü D8 (döndürme + ayna) ortalaması; CNN'de varsayılan açık (%89.7 → %90.3)
- **OOD kontrolü** — H&E/PCam profiline benzemeyen görsellerde "bu görsel uygun değil" uyarısı
- **PDF rapor** — her analiz için indirilebilir çıktı (görsel + Grad-CAM + skor + tarih + uyarı)
- **Hazır örnek galeri** — tıklayınca otomatik analiz edilen örnek görseller
- **Performans sayfası** — confusion matrix, ROC, precision-recall, reliability diyagramı
- **Landing page** — animasyonlu DNA sarmalı + koyu premium tema
- **TR / EN dil desteği** — tek tıkla dil değişimi

---

## 🖥️ Ekran Görüntüleri

### Landing
![Landing](docs/ss-landing.png)

### Analiz sayfası
![Analiz](docs/ss-analiz.png)

### Tahmin sonuçları (Grad-CAM ısı haritası ile)

| Kanserli | Sağlıklı | Belirsiz |
|---|---|---|
| ![Kanserli](docs/ss-kanserli.png) | ![Sağlıklı](docs/ss-saglikli.png) | ![Belirsiz](docs/ss-belirsiz.png) |

### Performans ve Hakkında

| Performans | Hakkında |
|---|---|
| ![Performans](docs/ss-performans.png) | ![Hakkında](docs/ss-hakkinda.png) |

---

## 🩺 Model ne yapıyor?

PCam, **Camelyon16** veri setinden türetilmiştir. Görüntüler meme kanseri
hastalarının **lenf düğümü** kesitleridir (H&E boyalı). Model, bir patch'in
merkezindeki dokuda **metastatik meme kanseri** olup olmadığını sınıflandırır.

- `0 = Sağlıklı`, `1 = Kanserli`
- Çıktı: 2 sınıflı softmax
- **Özel CNN (varsayılan):** 4 evrişim bloğu (Conv+BN+ReLU ×2 + MaxPool) → GlobalAvgPool → FC, 96×96 girdi
- **ResNet18/50:** transfer learning + fine-tuning, `Resize(224)` → ImageNet normalizasyonu
- Eğitim (özel CNN): güçlü augmentation (**D8 döndürme + HED stain**), AdamW + Cosine LR + label smoothing

### Model performansı (tüm PCam TEST seti, 32.768 örnek)

| Metrik | **Özel CNN** ⭐ (8-yönlü TTA) | ResNet18 |
|---|---|---|
| Test Doğruluğu | **%90.30** | %85.43 |
| Precision | 0.9431 | 0.9690 |
| Recall | **0.8577** | 0.7318 |
| F1-Score | **0.8984** | 0.8339 |

> **Özel CNN, kaçırılan kanseri ~%27'den ~%14'e düşürür** (recall 0.73 → 0.86) —
> klinik açıdan en kritik kazanç budur. Değerler 8-yönlü test-time augmentation
> (TTA) ile; uygulama CNN'i varsayılan olarak TTA ile servis eder. Yine de model
> klinik tanı için uygun değildir; yalnızca araştırma / eğitim amaçlıdır.

### Karışıklık Matrisi (Özel CNN — tüm TEST seti, 8-yönlü TTA)

![Confusion Matrix](docs/confusion_matrix.png)

|  | Tahmin: Sağlıklı | Tahmin: Kanserli |
|---|---|---|
| **Gerçek: Sağlıklı** | 15543 (TN) | 848 (FP) |
| **Gerçek: Kanserli** | 2330 (FN) | 14047 (TP) |

---

## 🏗️ Mimari

```
React (Vite, koyu tema)  ──>  nginx  ──>  FastAPI  ──>  PyTorch (ResNet18/50)
   Landing · Analiz              /api           /predict, /models
   Performans · Hakkında                        Grad-CAM · kalibrasyon · OOD
```

Sayfalar: **Landing** (DNA animasyonu) → **Analiz** (araç) · **Performans** (metrikler) · **Hakkında**. TR/EN dil desteği.

---

## 🚀 Çalıştırma

### Seçenek A — Docker (önerilen)

```bash
docker compose up --build
```

- Arayüz:  http://localhost:3000
- API:     http://localhost:8000/health

### Seçenek B — Yerel geliştirme

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Arayüz: http://localhost:5173

---

## 🧪 Test verisi üretme

Arayüzü denemek için PCam test setinden PNG patch'ler çıkar:

```bash
pip install h5py numpy pillow
python scripts/export_patches.py --n 20 --out test_patches
```

`test_patches/kanserli/` ve `test_patches/saglikli/` klasörlerine örnekler
düşer; bunları arayüze sürükle-bırak yapıp tahminleri kontrol edebilirsin.

> `data/` klasöründeki `.h5` dosyaları (8.5 GB) repoya dahil DEĞİLDİR.
> PCam'i [buradan](https://github.com/basveeling/pcam) indirebilirsin.

---

## 📁 Proje yapısı

```
OncoVision/
├─ backend/              # FastAPI + PyTorch inference
│  ├─ main.py            # /predict, /models endpoint'leri
│  ├─ inference.py       # model yükleme + preprocessing + Grad-CAM + kalibrasyon + OOD
│  └─ models/            # resnet18/50 .pth + *_temperature.json
├─ frontend/             # React (Vite) arayüz — Landing, Analiz, Performans, Hakkında
│  ├─ src/{pages,components}
│  └─ public/            # logo, örnek görseller, metrics.json
├─ scripts/              # yardımcı Python araçları
│  ├─ train.py           # eğitim
│  ├─ dataset.py         # veri yükleme + transforms
│  ├─ evaluate.py        # test / metrik
│  ├─ calibrate.py       # temperature scaling kalibrasyonu
│  ├─ compute_metrics.py # performans metrikleri -> metrics.json
│  └─ export_patches.py  # .h5 -> PNG test aracı
├─ docs/                 # ekran görüntüleri + rapor
├─ Dockerfile            # birleşik imaj (tek servis)
├─ docker-compose.yml    # backend + frontend
└─ README.md
```

---

## 📡 API

`POST /predict` — form-data `file` (görsel)

```json
{
  "prediction": "Kanserli",
  "tumor_probability": 0.9312,
  "healthy_probability": 0.0688,
  "confidence": 0.9312,
  "filename": "kanserli_123.png"
}
```

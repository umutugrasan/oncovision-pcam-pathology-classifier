# 🚀 Hugging Face Spaces'e Deploy (Ücretsiz)

Uygulama tek bir Docker imajı olarak yayına alınır: frontend + backend + API
aynı serviste (port 7860). Model ağırlıkları **build sırasında GitHub'dan
indirilir**, böylece HF Space'e büyük dosya (git-lfs) push etmene gerek yoktur.

> Ön koşul: Model dosyaları GitHub'da (`main` dalında) bulunmalı — mevcutta öyle.
> Kök `Dockerfile` bunları `raw.githubusercontent.com` üzerinden çeker.

---

## 1. Hugging Face hesabı ve Space oluştur

1. [huggingface.co](https://huggingface.co) → ücretsiz hesap aç.
2. Sağ üst → **New Space**.
3. Ayarlar:
   - **Owner:** kendi kullanıcı adın
   - **Space name:** `pcam-pathology-classifier`
   - **SDK:** **Docker** → **Blank** (boş)
   - **Hardware:** CPU basic (ücretsiz)
   - Visibility: Public
4. **Create Space** (şimdilik boş kalsın).

## 2. Access token al (şifre yerine kullanılır)

HF → **Settings → Access Tokens → New token** → rol **Write** → kopyala.

## 3. Kodu HF Space'e push et (modeller hariç, temiz)

Proje kökünde (`C:\Users\UMUT\Desktop\PCAM_PROJECT`) sırayla:

```bash
git checkout --orphan hf-space
git rm -r --cached . >/dev/null
echo "backend/models/*.pth" >> .gitignore
git add -A
git commit -m "HF Space: tek servis (modeller build sirasinda inecek)"
```

Sonra HF remote'unu ekle (kendi kullanıcı adın + space adınla) ve push et:

```bash
git remote add hf https://huggingface.co/spaces/<HF_KULLANICI_ADIN>/pcam-pathology-classifier
git push hf hf-space:main
```

- Kullanıcı adı istenince: HF kullanıcı adın
- Şifre istenince: **2. adımdaki Write token** (şifre değil!)

Son olarak ana dala geri dön:

```bash
git checkout main
```

## 4. Build'i izle

Space sayfasında **Building** durumu görünür (ilk build ~5-10 dk; torch +
model indirme). Bitince **Running** olur ve uygulama açılır:

```
https://huggingface.co/spaces/<HF_KULLANICI_ADIN>/pcam-pathology-classifier
```

## 5. LinkedIn'de paylaş

- Canlı link + kısa açıklama + `docs/ekran-kanserli.png` ekran görüntüsü.
- GitHub repo linkini de ekle.

---

## Sorun giderme

- **Build "model indirilemedi" hatası:** GitHub repo'sunun **public** ve
  `.pth` dosyalarının `main` dalında olduğundan emin ol. Farklı repo/branch için
  Space ayarlarından `MODEL_BASE_URL` build-arg'ını verebilirsin.
- **Space uykuya daldı:** Ücretsiz Space bir süre kullanılmazsa uyur; linke
  girince birkaç saniyede uyanır.
- **Güncelleme:** Kod değişince 3. adımı tekrar et (`hf-space` dalını güncelle
  ve `git push hf hf-space:main --force`).

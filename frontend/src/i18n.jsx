import { createContext, useContext, useState } from "react";

// Basit i18n: TR (varsayılan) ve EN. useT() ile mevcut dilin sözlüğü gelir.
const DICT = {
  tr: {
    lang: "TR",
    nav: { brand: "OncoVision", home: "Anasayfa", performance: "Performans", about: "Hakkında" },
    hero: {
      badge: "Meme Kanseri · Yapay Zeka",
      title: "Patoloji Görseli Analizi",
      title1: "Patoloji Görseli",
      title2: "Analizi",
      desc:
        "Lenf düğümünde metastatik meme kanseri tespiti için, bu proje için sıfırdan eğitilmiş özel bir CNN. Bir H&E patch'i yükle; model saniyeler içinde tahminini, güven skorunu ve odaklandığı bölgeyi (Grad-CAM) göstersin.",
    },
    tool: {
      model: "Model:",
      samplesTitle: "Görselin yok mu? Hazır bir örnek dene:",
      sampleTumor: "Kanserli örnek",
      sampleHealthy: "Sağlıklı örnek",
      sampleBorderline: "Sınırda örnek",
      analyze: "Analiz Et",
      analyzing: "Analiz ediliyor…",
      newAnalysis: "↺ Yeni Analiz",
      dropTitle: "Patoloji görselini sürükle-bırak",
      dropHint: "veya tıklayıp seç (PNG / JPG / TIFF)",
      scanText: "Morfoloji analiz ediliyor…",
    },
    result: {
      tumor: "🔴 Kanserli (Metastaz)",
      healthy: "🟢 Sağlıklı",
      uncertain: "🟡 Belirsiz — uzman incelemesi gerekli",
      uncertainNote: (pct, thr) =>
        `Model bu görselde karar sınırına çok yakın (tümör olasılığı ~%${pct}, eşik %${thr}). Güvenilir bir tahmin için tek başına yeterli değildir; uzman patolog incelemesi önerilir.`,
      oodTitle: "Bu görsel bu model için uygun değil.",
      oodReason:
        "Görselin renk profili H&E boyamasına benzemiyor. Bu model yalnızca H&E boyalı lenf düğümü patch'leri (PCam) için geçerlidir; sonuç güvenilmez.",
      tumorProb: "Tümör olasılığı",
      healthyProb: "Sağlıklı",
      threshold: "Karar eşiği",
      model: "Model",
      ttaOn: "8 yönlü TTA",
      gradcamTitle: "🔥 Modelin odaklandığı bölge (Grad-CAM)",
      gradcamHint:
        "Kırmızı = modelin en çok baktığı alan · yeşil kare = en yoğun bölge. Bu bir dikkat haritasıdır, kesin tümör sınırı değildir.",
      opacity: "Şeffaflık",
      pdf: "📄 PDF Rapor İndir",
      pdfLoading: "Rapor hazırlanıyor…",
    },
    threshold: {
      label: "Karar eşiği (kanser deme sınırı)",
      hint:
        "⬅ Düşük eşik: daha duyarlı, kanseri kaçırma azalır (recall ↑) · Yüksek eşik: daha temkinli, yanlış alarm azalır (precision ↑) ➡",
    },
    disclaimer: {
      strong: "⚠️ Yasal Uyarı:",
      text:
        " Bu araç yalnızca araştırma ve eğitim amaçlıdır ve klinik tanı için kullanılamaz. Model sadece H&E boyalı lenf düğümü patch'leri (PCam) için anlamlıdır; başka doku/organ görsellerinde sonuçlar geçersizdir. Nihai tanı her zaman uzman patolog tarafından konulmalıdır.",
    },
    about: {
      title: "Hakkında",
      subtitle: "Model, veri seti ve performans bilgisi",
      h2model: "Model ne yapıyor?",
      pModel:
        "Bu araç, PatchCamelyon (PCam) veri seti üzerinde eğitilmiş modellerle çalışır. Varsayılan ve en iyi model, bu proje için sıfırdan tasarlanıp eğitilen özel bir CNN'dir (görsel başına en yüksek TEST doğruluğu ve recall). Karşılaştırma için ResNet18 ve ResNet50 (transfer learning) de seçilebilir. PCam, Camelyon16'dan türetilmiştir; görüntüler meme kanseri hastalarının lenf düğümü kesitleridir (H&E boyalı). Model, bir patch'in merkez dokusunda metastatik meme kanseri olup olmadığını sınıflandırır.",
      h2tech: "Teknik detay",
      tech1: "Varsayılan: Özel CNN — 4 evrişim bloğu (BN + ReLU) + GlobalAvgPool, 96×96 girdi",
      tech2: "Çıktı: 2 sınıflı softmax (0 = Sağlıklı, 1 = Kanserli)",
      tech3: "Eğitim: güçlü augmentation (D8 + HED stain), AdamW + Cosine LR + label smoothing",
      h2perf: "Performans (Özel CNN — en iyi model, 8-yönlü TTA)",
      h2calib: "Güven skoru kalibrasyonu",
      pCalib:
        "Nöral ağların ham softmax çıktısı genelde aşırı özgüvenlidir; model yanılırken bile %99 diyebilir. Bunu düzeltmek için temperature scaling (Guo et al., 2017) uyguladık: özel CNN için validation setinde en iyi sıcaklık T = 0.84 bulundu ve logit'ler bu değere bölünerek güven yüzdesi gerçekçi hale getirildi. Kalibrasyon hatası (ECE) 0.0271 → 0.0047'ye düştü. Bu işlem tahminleri ve doğruluğu değiştirmez; yalnızca gösterilen yüzdeyi güvenilir kılar.",
      warn:
        "⚠️ Kısıt: Recall ~0.86 olduğundan model, gerçek kanserli vakaların yaklaşık %14'ünü kaçırabilir. Bu nedenle araç klinik tanı için uygun değildir ve yalnızca araştırma / eğitim amaçlıdır.",
      credit: "Geliştiren",
    },
    landing: {
      tagline: "Yapay zekâ ile patoloji görüntü analizi",
      desc: "Lenf düğümü patoloji görsellerinde (H&E) metastatik meme kanserini, bu proje için sıfırdan eğitilmiş özel bir CNN ile saniyeler içinde tespit eden bir analiz aracı. Tahmin, güven skoru ve modelin odaklandığı bölgeyi (Grad-CAM) sunar.",
      items: ["Analiz", "Performans", "Hakkında", "İletişim"],
      cta: "Analize Başla",
      rights: "© 2026 OncoVision",
      disclaimer: "⚠️ Bu araç yalnızca araştırma ve eğitim amaçlıdır; klinik tanı için kullanılamaz. Nihai tanı her zaman uzman patolog tarafından konulmalıdır.",
    },
    perf: {
      title: "Model Performansı",
      subtitle: (n) => `Test seti (${n} örnek) · kalibre olasılıklar`,
      model: "Model:",
      accuracy: "Doğruluk",
      cmTitle: "Karışıklık Matrisi (eşik 0.5)",
      cmPredHealthy: "Tahmin: Sağlıklı",
      cmPredTumor: "Tahmin: Kanserli",
      cmRealHealthy: "Gerçek: Sağlıklı",
      cmRealTumor: "Gerçek: Kanserli",
      cmHint: (fn) => `🔴 Sol-alt (FN=${fn}) = kaçırılan kanserler — tıbbi olarak en kritik hata.`,
      roc: "ROC Eğrisi",
      rocX: "Yanlış Pozitif Oranı",
      rocY: "Doğru Pozitif Oranı",
      pr: "Precision-Recall",
      relTitle: "Kalibrasyon (Reliability)",
      relX: "Güven",
      relY: "Gerçek İsabet",
      relHint: (b, a) =>
        `🔴 Kalibrasyon öncesi (ECE ${b}) · 🟢 sonrası (ECE ${a}). Kesikli çizgiye yakın = daha dürüst güven.`,
      loading: "Yükleniyor…",
      missing: "Metrik dosyası bulunamadı.",
    },
  },
  en: {
    lang: "EN",
    nav: { brand: "OncoVision", home: "Home", performance: "Performance", about: "About" },
    hero: {
      badge: "Breast Cancer · AI",
      title: "Pathology Image Analysis",
      title1: "Pathology Image",
      title2: "Analysis",
      desc:
        "A custom CNN, trained from scratch for this project, for detecting metastatic breast cancer in lymph nodes. Upload an H&E patch and the model returns a prediction, confidence score, and the region it focused on (Grad-CAM) within seconds.",
    },
    tool: {
      model: "Model:",
      samplesTitle: "No image? Try a ready-made sample:",
      sampleTumor: "Tumor sample",
      sampleHealthy: "Healthy sample",
      sampleBorderline: "Borderline sample",
      analyze: "Analyze",
      analyzing: "Analyzing…",
      newAnalysis: "↺ New Analysis",
      dropTitle: "Drag & drop a pathology image",
      dropHint: "or click to browse (PNG / JPG / TIFF)",
      scanText: "Analyzing morphology…",
    },
    result: {
      tumor: "🔴 Tumor (Metastasis)",
      healthy: "🟢 Healthy",
      uncertain: "🟡 Uncertain — expert review needed",
      uncertainNote: (pct, thr) =>
        `The model is very close to the decision boundary here (tumor probability ~${pct}%, threshold ${thr}%). Not reliable on its own; expert pathologist review is recommended.`,
      oodTitle: "This image is not suitable for this model.",
      oodReason:
        "The image's color profile does not resemble H&E staining. This model is only valid for H&E-stained lymph node patches (PCam); the result is unreliable.",
      tumorProb: "Tumor probability",
      healthyProb: "Healthy",
      threshold: "Decision threshold",
      model: "Model",
      ttaOn: "8-way TTA",
      gradcamTitle: "🔥 Region the model focused on (Grad-CAM)",
      gradcamHint:
        "Red = where the model looked most · green box = the hottest region. This is an attention map, not a precise tumor boundary.",
      opacity: "Opacity",
      pdf: "📄 Download PDF Report",
      pdfLoading: "Preparing report…",
    },
    threshold: {
      label: "Decision threshold (cancer-call cutoff)",
      hint:
        "⬅ Lower: more sensitive, fewer missed cancers (recall ↑) · Higher: more cautious, fewer false alarms (precision ↑) ➡",
    },
    disclaimer: {
      strong: "⚠️ Disclaimer:",
      text:
        " This tool is for research and education only and cannot be used for clinical diagnosis. The model is only meaningful for H&E-stained lymph node patches (PCam); results are invalid for other tissues/organs. Final diagnosis must always be made by an expert pathologist.",
    },
    about: {
      title: "About",
      subtitle: "Model, dataset and performance",
      h2model: "What does the model do?",
      pModel:
        "This tool runs models trained on the PatchCamelyon (PCam) dataset. The default and best model is a custom CNN designed and trained from scratch for this project (highest TEST accuracy and recall). ResNet18 and ResNet50 (transfer learning) are also selectable for comparison. PCam is derived from Camelyon16; the images are lymph node sections of breast cancer patients (H&E-stained). The model classifies whether a patch's center tissue contains metastatic breast cancer.",
      h2tech: "Technical details",
      tech1: "Default: custom CNN — 4 conv blocks (BN + ReLU) + GlobalAvgPool, 96×96 input",
      tech2: "Output: 2-class softmax (0 = Healthy, 1 = Tumor)",
      tech3: "Training: strong augmentation (D8 + HED stain), AdamW + Cosine LR + label smoothing",
      h2perf: "Performance (custom CNN — best model, 8-way TTA)",
      h2calib: "Confidence calibration",
      pCalib:
        "Raw softmax outputs of neural nets are usually overconfident; the model can say 99% even when wrong. To fix this we applied temperature scaling (Guo et al., 2017): for the custom CNN the best temperature T = 0.84 was found on the validation set and logits are divided by it to make the confidence realistic. Calibration error (ECE) dropped 0.0271 → 0.0047. This does not change predictions or accuracy; it only makes the displayed percentage trustworthy.",
      warn:
        "⚠️ Limitation: With recall ~0.86, the model may miss about 14% of true cancer cases. Therefore the tool is not suitable for clinical diagnosis and is for research / education only.",
      credit: "Created by",
    },
    landing: {
      tagline: "AI-powered pathology image analysis",
      desc: "An analysis tool that detects metastatic breast cancer in lymph node pathology images (H&E) within seconds, using a custom CNN trained from scratch for this project. It provides the prediction, a confidence score, and the region the model focused on (Grad-CAM).",
      items: ["Analyze", "Performance", "About", "Contact"],
      cta: "Start Analysis",
      rights: "© 2026 OncoVision",
      disclaimer: "⚠️ This tool is for research and education only and cannot be used for clinical diagnosis. Final diagnosis must always be made by an expert pathologist.",
    },
    perf: {
      title: "Model Performance",
      subtitle: (n) => `Test set (${n} samples) · calibrated probabilities`,
      model: "Model:",
      accuracy: "Accuracy",
      cmTitle: "Confusion Matrix (threshold 0.5)",
      cmPredHealthy: "Pred: Healthy",
      cmPredTumor: "Pred: Tumor",
      cmRealHealthy: "True: Healthy",
      cmRealTumor: "True: Tumor",
      cmHint: (fn) => `🔴 Bottom-left (FN=${fn}) = missed cancers — the most critical error clinically.`,
      roc: "ROC Curve",
      rocX: "False Positive Rate",
      rocY: "True Positive Rate",
      pr: "Precision-Recall",
      relTitle: "Calibration (Reliability)",
      relX: "Confidence",
      relY: "Actual Accuracy",
      relHint: (b, a) =>
        `🔴 Before calibration (ECE ${b}) · 🟢 after (ECE ${a}). Closer to the dashed line = more honest confidence.`,
      loading: "Loading…",
      missing: "Metrics file not found.",
    },
  },
};

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState("tr");
  return (
    <LangContext.Provider value={{ lang, setLang, t: DICT[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  return useContext(LangContext).t;
}

export function useLang() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang };
}

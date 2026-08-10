import { jsPDF } from "jspdf";

// jsPDF varsayılan fontu Türkçe ğ/ş/ı karakterlerini bozuyor;
// PDF metinlerini ASCII-güvenli yazmak için sadeleştiriyoruz.
function ascii(s) {
  return String(s)
    .replaceAll("ğ", "g").replaceAll("Ğ", "G")
    .replaceAll("ş", "s").replaceAll("Ş", "S")
    .replaceAll("ı", "i").replaceAll("İ", "I")
    .replaceAll("ç", "c").replaceAll("Ç", "C")
    .replaceAll("ö", "o").replaceAll("Ö", "O")
    .replaceAll("ü", "u").replaceAll("Ü", "U");
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Orijinal + ısı haritasını (verilen opaklıkta) tek görsele birleştir
async function buildComposite(preview, heatmap, opacity) {
  const size = 300;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (preview) ctx.drawImage(await loadImg(preview), 0, 0, size, size);
  if (heatmap) {
    ctx.globalAlpha = opacity ?? 0.6;
    ctx.drawImage(await loadImg(heatmap), 0, 0, size, size);
    ctx.globalAlpha = 1;
  }
  return canvas.toDataURL("image/png");
}

export async function raporIndir({ result, preview, threshold = 0.5, hmOpacity = 0.6 }) {
  const pTumor = result.tumor_probability;
  const tumorPct = Math.round(pTumor * 100);
  const thrPct = Math.round(threshold * 100);
  const isTumor = pTumor >= threshold;
  const isUncertain = Math.abs(pTumor - threshold) <= 0.1;
  const label = isUncertain
    ? "Belirsiz - uzman incelemesi gerekli"
    : isTumor
    ? "Kanserli (Metastaz)"
    : "Saglikli";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 20;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PCam Patoloji Analiz Raporu", M, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Arastirma/egitim amaclidir - klinik tani icin kullanilamaz.", M, y);
  y += 9;

  doc.setTextColor(0);
  doc.setFontSize(11);
  const satirlar = [
    `Tarih: ${new Date().toLocaleString("tr-TR")}`,
    `Model: ${(result.model || "-").toUpperCase()}${result.tta ? " (TTA acik)" : ""}`,
    `Tahmin: ${ascii(label)}`,
    `Tumor olasiligi: %${tumorPct}`,
    `Saglikli olasiligi: %${Math.round(result.healthy_probability * 100)}`,
    `Karar esigi: %${thrPct}`,
    result.filename ? `Dosya: ${ascii(result.filename)}` : null,
  ].filter(Boolean);
  for (const s of satirlar) {
    doc.text(s, M, y);
    y += 6;
  }
  y += 2;

  // Uygun degil (OOD) uyarisi
  if (result.suitability && result.suitability.suitable === false) {
    doc.setTextColor(200, 0, 0);
    doc.setFontSize(10);
    const w = doc.splitTextToSize(
      "UYARI: Bu gorsel bu model icin uygun degil (renk profili H&E boyamasina "
        + "benzemiyor). Sonuc guvenilmez.",
      170
    );
    doc.text(w, M, y);
    y += w.length * 5 + 2;
    doc.setTextColor(0);
  }

  // Kompozit gorsel (orijinal + Grad-CAM)
  try {
    const img = await buildComposite(preview, result.heatmap, hmOpacity);
    doc.setFontSize(10);
    doc.text("Grad-CAM (modelin odaklandigi bolge):", M, y);
    y += 4;
    doc.addImage(img, "PNG", M, y, 65, 65);
    y += 70;
  } catch {
    /* gorsel eklenemezse rapor yine olusur */
  }

  // Yasal uyari
  doc.setDrawColor(220);
  doc.line(M, y, 190, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(120);
  const uyari = doc.splitTextToSize(
    ascii(
      "Yasal Uyari: Bu arac yalnizca arastirma ve egitim amaclidir ve klinik tani "
        + "icin kullanilamaz. Model yalnizca H&E boyali lenf dugumu patch'leri (PCam) "
        + "icin anlamlidir. Model gercek kanserli vakalarin bir kismini kacirabilir. "
        + "Nihai tani her zaman uzman patolog tarafindan konulmalidir."
    ),
    170
  );
  doc.text(uyari, M, y);

  const ts = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  doc.save(`pcam-rapor-${ts}.pdf`);
}

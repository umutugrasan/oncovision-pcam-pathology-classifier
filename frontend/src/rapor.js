import { jsPDF } from "jspdf";

// jsPDF varsayılan fontu Türkçe ğ/ş/ı'yı bozuyor; metinleri ASCII-güvenli yaz.
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
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  if (preview) ctx.drawImage(await loadImg(preview), 0, 0, size, size);
  if (heatmap) {
    ctx.globalAlpha = opacity ?? 0.6;
    ctx.drawImage(await loadImg(heatmap), 0, 0, size, size);
    ctx.globalAlpha = 1;
  }
  return canvas.toDataURL("image/png");
}

// Bir görüntüyü belirli genişliğe küçülterek dataURL döndür (PDF boyutu için)
function imgToDataUrl(img, maxW = 300) {
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/png");
}

// Renkler
const INK = [27, 37, 89];        // koyu lacivert
const PINK = [229, 57, 111];
const GREEN = [22, 130, 74];
const AMBER = [180, 110, 30];
const GRAY = [120, 120, 135];
const LINE = [200, 200, 210];

export async function raporIndir({ result, preview, threshold = 0.5, hmOpacity = 0.6 }) {
  const pTumor = result.tumor_probability;
  const tumorPct = Math.round(pTumor * 100);
  const healthyPct = Math.round(result.healthy_probability * 100);
  const thrPct = Math.round(threshold * 100);
  const isTumor = pTumor >= threshold;
  const isUncertain = Math.abs(pTumor - threshold) <= 0.1;
  const unsuitable = result.suitability && result.suitability.suitable === false;
  const modelName = (result.model || "-").toUpperCase();

  const label = isUncertain
    ? "BELIRSIZ - Uzman incelemesi gerekli"
    : isTumor
    ? "KANSERLI (Metastaz saptandi)"
    : "SAGLIKLI (Metastaz saptanmadi)";
  const stateColor = isUncertain ? AMBER : isTumor ? PINK : GREEN;

  // Kısa analiz metni
  let yorum;
  if (unsuitable) {
    yorum =
      "Yuklenen goruntunun renk profili H&E boyamasina benzemedigi icin bu model " +
      "icin uygun degildir; asagidaki sonuc guvenilir kabul edilmemelidir.";
  } else if (isUncertain) {
    yorum =
      `Model, bu H&E patch'inde karar sinirina cok yakin bir sonuc uretmistir ` +
      `(tumor olasiligi %${tumorPct}, karar esigi %${thrPct}). Bu nedenle ` +
      `siniflandirma guvenilir kabul edilmemeli, orneklem uzman patolog tarafindan degerlendirilmelidir.`;
  } else if (isTumor) {
    yorum =
      `Model, bu H&E boyali lenf dugumu patch'inde metastatik meme kanseri bulgusu ` +
      `tespit etmistir (tumor olasiligi %${tumorPct}). Grad-CAM dikkat haritasi, modelin ` +
      `kararini olustururken isaretli (yesil kare) bolgeye odaklandigini gostermektedir. ` +
      `Bu otomatik bir on-degerlendirmedir; kesin tani icin uzman patolog incelemesi sarttir.`;
  } else {
    yorum =
      `Model, bu H&E patch'inde metastatik kanser bulgusu tespit etmemistir ` +
      `(tumor olasiligi %${tumorPct}, saglikli olasiligi %${healthyPct}). ` +
      `Yine de dusuk olasilikli vakalar tamamen dislanamaz; supheli durumlarda ` +
      `uzman patolog degerlendirmesi onerilir.`;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 14, R = 196, W = R - L;

  // dış çerçeve
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 194, 281);

  // ---- BAŞLIK ----
  try {
    const logo = await loadImg("/logo.png");
    const h = 16, w = (logo.naturalWidth / logo.naturalHeight) * h;
    doc.addImage(imgToDataUrl(logo, 260), "PNG", L, 12, w, h);
  } catch { /* logo yoksa gec */ }

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("OncoVision", 105, 19, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GRAY);
  doc.text("Yapay Zeka Destekli Patoloji Goruntu Analiz Raporu", 105, 26, { align: "center" });

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(L, 31, R, 31);

  let y = 39;

  // ---- BÖLÜM BAŞLIĞI yardımcı ----
  const sectionBar = (text) => {
    doc.setFillColor(...INK);
    doc.rect(L, y, W, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(ascii(text), L + 2.5, y + 4.8);
    y += 7;
  };

  // ---- BİLGİ TABLOSU ----
  sectionBar("RAPOR BILGILERI");
  const now = new Date();
  const ts =
    now.toISOString().slice(0, 10).replaceAll("-", "") + "-" +
    now.toTimeString().slice(0, 8).replaceAll(":", "");
  const rows = [
    ["Rapor No", `OV-${ts}`, "Model", modelName],
    ["Rapor Tarihi", now.toLocaleString("tr-TR"), "Analiz Tipi", result.tta ? "TTA (4 varyant ort.)" : "Tekli"],
    ["Dosya Adi", result.filename || "-", "Karar Esigi", `%${thrPct}`],
  ];
  const rh = 7.5;
  const midX = L + W / 2;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  rows.forEach((r, i) => {
    const ry = y + i * rh;
    doc.rect(L, ry, W, rh);
    doc.line(midX, ry, midX, ry + rh);
    const cell = (x, k, v) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(ascii(k) + ":", x + 2, ry + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 60);
      doc.text(ascii(String(v)).slice(0, 34), x + 26, ry + 5);
    };
    cell(L, r[0], r[1]);
    cell(midX, r[2], r[3]);
  });
  y += rows.length * rh + 5;

  // ---- GÖRÜNTÜ (ham + Grad-CAM) ----
  sectionBar("HAM GORUNTU  VE  GRAD-CAM ISI HARITASI");
  y += 3;
  const imgS = 46;
  const gap = 6;
  try {
    const raw = await loadImg(preview);
    doc.addImage(imgToDataUrl(raw, 300), "PNG", L, y, imgS, imgS);
  } catch { /* gec */ }
  try {
    const comp = await buildComposite(preview, result.heatmap, hmOpacity);
    doc.addImage(comp, "PNG", L + imgS + gap, y, imgS, imgS);
  } catch { /* gec */ }
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(L, y, imgS, imgS);
  doc.rect(L + imgS + gap, y, imgS, imgS);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Ham Patoloji Goruntusu", L + imgS / 2, y + imgS + 4.5, { align: "center" });
  doc.text("Grad-CAM Isi Haritasi", L + imgS + gap + imgS / 2, y + imgS + 4.5, { align: "center" });
  // sağda açıklama
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 80);
  const lx = L + 2 * imgS + gap + 6;
  const legend = doc.splitTextToSize(
    "Solda analiz edilen ham H&E patch'i; sagda modelin Grad-CAM dikkat haritasi bindirilmis " +
    "hali. Kirmizi tonlar modelin en cok odaklandigi alani, yesil kare ise en yogun bolgeyi " +
    "gosterir. Bu bir dikkat haritasidir; kesin tumor siniri degildir.",
    R - lx
  );
  doc.text(legend, lx, y + 5);
  y += imgS + 9;

  // ---- SONUÇ ----
  sectionBar("ANALIZ SONUCU");
  y += 2;
  const boxH = 26;
  doc.setDrawColor(...stateColor);
  doc.setLineWidth(0.8);
  doc.setFillColor(250, 248, 250);
  doc.rect(L, y, W, boxH, "FD");
  // sol renk şeridi
  doc.setFillColor(...stateColor);
  doc.rect(L, y, 2.5, boxH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...stateColor);
  doc.text(ascii(label), L + 7, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(`Tumor olasiligi: %${tumorPct}`, L + 7, y + 16.5);
  doc.text(`Saglikli olasiligi: %${healthyPct}`, L + 60, y + 16.5);
  doc.text(`Model: ${modelName}`, L + 7, y + 22.5);
  doc.text(`Karar esigi: %${thrPct}${result.tta ? "  -  TTA acik" : ""}`, L + 60, y + 22.5);
  // olasılık çubuğu (sağda, kutu içinde)
  const barX = L + 112, barW = 58, barY = y + 13;
  doc.setFillColor(235, 230, 235);
  doc.rect(barX, barY, barW, 4, "F");
  doc.setFillColor(...stateColor);
  doc.rect(barX, barY, (barW * tumorPct) / 100, 4, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text("tumor %", barX + barW - 12, barY - 1.8);
  doc.text("0", barX, barY + 7.5);
  doc.text("100", barX + barW - 5, barY + 7.5);
  y += boxH + 5;

  // ---- KISA ANALİZ ----
  sectionBar("KISA ANALIZ / YORUM");
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 55);
  const yorumLines = doc.splitTextToSize(ascii(yorum), W - 2);
  doc.text(yorumLines, L + 1, y + 2);
  y += yorumLines.length * 5 + 4;

  // ---- FOOTER ----
  const fy = 256;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(L, fy, R, fy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PINK);
  doc.text("YASAL UYARI", L, fy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const uyari = doc.splitTextToSize(
    ascii(
      "Bu rapor OncoVision yapay zeka araci tarafindan otomatik uretilmistir ve yalnizca " +
      "arastirma/egitim amaclidir; klinik tani icin kullanilamaz. Model yalnizca H&E boyali " +
      "lenf dugumu patch'leri (PCam) icin gecerlidir ve gercek kanserli vakalarin bir kismini " +
      "kacirabilir. Nihai tani her zaman uzman patolog tarafindan konulmalidir."
    ),
    W
  );
  doc.text(uyari, L, fy + 9);
  // kredi satırı — uyarının altında (dinamik), üst satırla iç içe girmez
  const cy = fy + 9 + uyari.length * 3.5 + 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(L, cy - 3.5, R, cy - 3.5);
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.text("OncoVision  -  Created by Umut Ugrasan  -  github.com/umutugrasan", L, cy);
  doc.text("Sayfa 1 / 1", R, cy, { align: "right" });

  const fname = `OncoVision-rapor-${ts}.pdf`;
  doc.save(fname);
}

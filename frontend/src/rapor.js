import { jsPDF } from "jspdf";

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
const INK = [27, 37, 89];
const PINK = [229, 57, 111];
const GREEN = [22, 130, 74];
const AMBER = [180, 110, 30];
const GRAY = [120, 120, 135];
const LINE = [200, 200, 210];
const FONT = "DejaVu"; // Türkçe destekli gömülü font

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
    ? "BELİRSİZ — Uzman incelemesi gerekli"
    : isTumor
    ? "KANSERLİ (Metastaz saptandı)"
    : "SAĞLIKLI (Metastaz saptanmadı)";
  const stateColor = isUncertain ? AMBER : isTumor ? PINK : GREEN;

  let yorum;
  if (unsuitable) {
    yorum =
      "Yüklenen görüntünün renk profili H&E boyamasına benzemediği için bu model için uygun " +
      "değildir; aşağıdaki sonuç güvenilir kabul edilmemelidir.";
  } else if (isUncertain) {
    yorum =
      `Model, bu H&E patch'inde karar sınırına çok yakın bir sonuç üretmiştir ` +
      `(tümör olasılığı %${tumorPct}, karar eşiği %${thrPct}). Bu nedenle sınıflandırma ` +
      `güvenilir kabul edilmemeli, örneklem uzman patolog tarafından değerlendirilmelidir.`;
  } else if (isTumor) {
    yorum =
      `Model, bu H&E boyalı lenf düğümü patch'inde metastatik meme kanseri bulgusu tespit ` +
      `etmiştir (tümör olasılığı %${tumorPct}). Grad-CAM dikkat haritası, modelin kararını ` +
      `oluştururken işaretli (yeşil kare) bölgeye odaklandığını göstermektedir. Bu otomatik ` +
      `bir ön-değerlendirmedir; kesin tanı için uzman patolog incelemesi şarttır.`;
  } else {
    yorum =
      `Model, bu H&E patch'inde metastatik kanser bulgusu tespit etmemiştir ` +
      `(tümör olasılığı %${tumorPct}, sağlıklı olasılığı %${healthyPct}). Yine de düşük ` +
      `olasılıklı vakalar tamamen dışlanamaz; şüpheli durumlarda uzman patolog değerlendirmesi önerilir.`;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Türkçe destekli fontu göm (yalnızca rapor üretilirken yüklenir)
  const { DEJAVU_REGULAR, DEJAVU_BOLD } = await import("./fonts-dejavu.js");
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_REGULAR);
  doc.addFont("DejaVuSans.ttf", FONT, "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_BOLD);
  doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");

  const L = 14, R = 196, W = R - L;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 194, 281);

  // ---- BAŞLIK ----
  try {
    const logo = await loadImg("/logo.png");
    const h = 16, w = (logo.naturalWidth / logo.naturalHeight) * h;
    doc.addImage(imgToDataUrl(logo, 260), "PNG", L, 12, w, h);
  } catch { /* logo yoksa geç */ }

  doc.setTextColor(...INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(19);
  doc.text("OncoVision", 105, 19, { align: "center" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GRAY);
  doc.text("Yapay Zekâ Destekli Patoloji Görüntü Analiz Raporu", 105, 26, { align: "center" });

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(L, 31, R, 31);

  let y = 39;

  const sectionBar = (text) => {
    doc.setFillColor(...INK);
    doc.rect(L, y, W, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(FONT, "bold");
    doc.setFontSize(9.5);
    doc.text(text, L + 2.5, y + 4.8);
    y += 7;
  };

  // ---- BİLGİ TABLOSU ----
  sectionBar("RAPOR BİLGİLERİ");
  const now = new Date();
  const ts =
    now.toISOString().slice(0, 10).replaceAll("-", "") + "-" +
    now.toTimeString().slice(0, 8).replaceAll(":", "");
  const rows = [
    ["Rapor No", `OV-${ts}`, "Model", modelName],
    ["Rapor Tarihi", now.toLocaleString("tr-TR"), "Analiz Tipi", result.tta ? "TTA (4 varyant ort.)" : "Tekli"],
    ["Dosya Adı", result.filename || "-", "Karar Eşiği", `%${thrPct}`],
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
      doc.setFont(FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(k + ":", x + 2, ry + 5);
      doc.setFont(FONT, "normal");
      doc.setTextColor(50, 50, 60);
      doc.text(String(v).slice(0, 34), x + 26, ry + 5);
    };
    cell(L, r[0], r[1]);
    cell(midX, r[2], r[3]);
  });
  y += rows.length * rh + 5;

  // ---- GÖRÜNTÜ ----
  sectionBar("HAM GÖRÜNTÜ  VE  GRAD-CAM ISI HARİTASI");
  y += 3;
  const imgS = 46, gap = 6;
  try {
    const raw = await loadImg(preview);
    doc.addImage(imgToDataUrl(raw, 300), "PNG", L, y, imgS, imgS);
  } catch { /* geç */ }
  try {
    const comp = await buildComposite(preview, result.heatmap, hmOpacity);
    doc.addImage(comp, "PNG", L + imgS + gap, y, imgS, imgS);
  } catch { /* geç */ }
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(L, y, imgS, imgS);
  doc.rect(L + imgS + gap, y, imgS, imgS);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Ham Patoloji Görüntüsü", L + imgS / 2, y + imgS + 4.5, { align: "center" });
  doc.text("Grad-CAM Isı Haritası", L + imgS + gap + imgS / 2, y + imgS + 4.5, { align: "center" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 80);
  const lx = L + 2 * imgS + gap + 6;
  const legend = doc.splitTextToSize(
    "Solda analiz edilen ham H&E patch'i; sağda modelin Grad-CAM dikkat haritası bindirilmiş " +
    "hâli. Kırmızı tonlar modelin en çok odaklandığı alanı, yeşil kare ise en yoğun bölgeyi " +
    "gösterir. Bu bir dikkat haritasıdır; kesin tümör sınırı değildir.",
    R - lx
  );
  doc.text(legend, lx, y + 5);
  y += imgS + 9;

  // ---- SONUÇ ----
  sectionBar("ANALİZ SONUCU");
  y += 2;
  const boxH = 26;
  doc.setDrawColor(...stateColor);
  doc.setLineWidth(0.8);
  doc.setFillColor(250, 248, 250);
  doc.rect(L, y, W, boxH, "FD");
  doc.setFillColor(...stateColor);
  doc.rect(L, y, 2.5, boxH, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...stateColor);
  doc.text(label, L + 7, y + 9);
  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(`Tümör olasılığı: %${tumorPct}`, L + 7, y + 16.5);
  doc.text(`Sağlıklı olasılığı: %${healthyPct}`, L + 60, y + 16.5);
  doc.text(`Model: ${modelName}`, L + 7, y + 22.5);
  doc.text(`Karar eşiği: %${thrPct}${result.tta ? "  ·  TTA açık" : ""}`, L + 60, y + 22.5);
  const barX = L + 112, barW = 58, barY = y + 13;
  doc.setFillColor(235, 230, 235);
  doc.rect(barX, barY, barW, 4, "F");
  doc.setFillColor(...stateColor);
  doc.rect(barX, barY, (barW * tumorPct) / 100, 4, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text("tümör %", barX + barW - 12, barY - 1.8);
  doc.text("0", barX, barY + 7.5);
  doc.text("100", barX + barW - 5, barY + 7.5);
  y += boxH + 5;

  // ---- KISA ANALİZ ----
  sectionBar("KISA ANALİZ / YORUM");
  y += 3;
  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 55);
  const yorumLines = doc.splitTextToSize(yorum, W - 2);
  doc.text(yorumLines, L + 1, y + 2);
  y += yorumLines.length * 5 + 4;

  // ---- FOOTER ----
  const fy = 256;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(L, fy, R, fy);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PINK);
  doc.text("YASAL UYARI", L, fy + 5);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const uyari = doc.splitTextToSize(
    "Bu rapor OncoVision yapay zekâ aracı tarafından otomatik üretilmiştir ve yalnızca " +
    "araştırma/eğitim amaçlıdır; klinik tanı için kullanılamaz. Model yalnızca H&E boyalı " +
    "lenf düğümü patch'leri (PCam) için geçerlidir ve gerçek kanserli vakaların bir kısmını " +
    "kaçırabilir. Nihai tanı her zaman uzman patolog tarafından konulmalıdır.",
    W
  );
  doc.text(uyari, L, fy + 9);
  const cy = fy + 9 + uyari.length * 3.5 + 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(L, cy - 3.5, R, cy - 3.5);
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.text("OncoVision  ·  Created by Umut Uğraşan  ·  github.com/umutugrasan", L, cy);
  doc.text("Sayfa 1 / 1", R, cy, { align: "right" });

  doc.save(`OncoVision-rapor-${ts}.pdf`);
}

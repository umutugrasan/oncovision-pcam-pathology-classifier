/**
 * Tahmin sonucunu gösteren kart.
 * props: result -> backend'den dönen tahmin nesnesi
 */
import { useState } from "react";

export default function SonucKarti({ result, threshold = 0.5, preview }) {
  const [hmOpacity, setHmOpacity] = useState(0.6); // ısı haritası opaklığı
  const pTumor = result.tumor_probability;
  const tumorPct = Math.round(pTumor * 100);
  const thrPct = Math.round(threshold * 100);

  // Karar ve belirsizlik artık kullanıcı eşiğine göre hesaplanır.
  const isTumor = pTumor >= threshold;
  const isUncertain = Math.abs(pTumor - threshold) <= 0.1;

  const stateClass = isUncertain ? "uncertain" : isTumor ? "tumor" : "healthy";
  const label = isUncertain
    ? "🟡 Belirsiz — uzman incelemesi gerekli"
    : isTumor
    ? "🔴 Kanserli (Metastaz)"
    : "🟢 Sağlıklı";

  const unsuitable = result.suitability && result.suitability.suitable === false;

  return (
    <div className={`result ${stateClass}`}>
      {unsuitable && (
        <div className="ood-warning">
          🚫 <strong>Bu görsel bu model için uygun değil.</strong>{" "}
          {result.suitability.reason}
        </div>
      )}
      <div className="result-label">{label}</div>

      {isUncertain && (
        <div className="uncertain-note">
          Model bu görselde karar sınırına çok yakın (tümör olasılığı ~%
          {tumorPct}, eşik %{thrPct}). Güvenilir bir tahmin için tek başına
          yeterli değildir; uzman patolog incelemesi önerilir.
        </div>
      )}
      <div className="score-row">
        <span>Tümör olasılığı</span>
        <strong>{tumorPct}%</strong>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${tumorPct}%` }} />
        {/* karar eşiği işareti */}
        <div className="bar-threshold" style={{ left: `${thrPct}%` }} />
      </div>
      <div className="score-detail">
        Sağlıklı: {Math.round(result.healthy_probability * 100)}% · Karar eşiği:
        %{thrPct}
        {result.model && ` · Model: ${result.model.toUpperCase()}`}
        {result.tta && " · TTA açık"}
      </div>

      {result.heatmap && (
        <div className="heatmap-box">
          <div className="heatmap-title">
            🔥 Modelin odaklandığı bölge (Grad-CAM)
          </div>
          <div className="heatmap-stack">
            {preview && <img src={preview} alt="orijinal" className="heatmap-img" />}
            <img
              src={result.heatmap}
              alt="ısı haritası"
              className="heatmap-img heatmap-overlay"
              style={{ opacity: hmOpacity }}
            />
          </div>
          <div className="opacity-row">
            <span>Şeffaflık</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={hmOpacity}
              onChange={(e) => setHmOpacity(parseFloat(e.target.value))}
              className="threshold-slider"
            />
          </div>
          <div className="heatmap-hint">
            Kırmızı = modelin en çok baktığı alan · yeşil kare = en yoğun bölge.
            Bu bir dikkat haritasıdır, kesin tümör sınırı değildir.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tahmin sonucunu gösteren kart.
 * props: result -> backend'den dönen tahmin nesnesi
 */
export default function SonucKarti({ result, threshold = 0.5 }) {
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

  return (
    <div className={`result ${stateClass}`}>
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
      </div>

      {result.heatmap && (
        <div className="heatmap-box">
          <div className="heatmap-title">
            🔥 Modelin odaklandığı bölge (Grad-CAM)
          </div>
          <img src={result.heatmap} alt="ısı haritası" className="heatmap-img" />
          <div className="heatmap-hint">
            Kırmızı = modelin en çok baktığı alan · yeşil kare = en yoğun bölge.
            Bu bir dikkat haritasıdır, kesin tümör sınırı değildir.
          </div>
        </div>
      )}
    </div>
  );
}

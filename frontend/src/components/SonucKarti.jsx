/**
 * Tahmin sonucunu gösteren kart.
 * props: result -> backend'den dönen tahmin nesnesi
 */
export default function SonucKarti({ result }) {
  const isTumor = result.prediction === "Kanserli";
  const isUncertain = result.uncertain;
  const tumorPct = Math.round(result.tumor_probability * 100);

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
          {tumorPct}). Güvenilir bir tahmin için tek başına yeterli değildir;
          uzman patolog incelemesi önerilir.
        </div>
      )}
      <div className="score-row">
        <span>Tümör olasılığı</span>
        <strong>{tumorPct}%</strong>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${tumorPct}%` }} />
      </div>
      <div className="score-detail">
        Güven: {Math.round(result.confidence * 100)}% · Sağlıklı:{" "}
        {Math.round(result.healthy_probability * 100)}%
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

/**
 * Tahmin sonucunu gösteren kart.
 * props: result -> backend'den dönen tahmin nesnesi
 */
export default function SonucKarti({ result }) {
  const isTumor = result.prediction === "Kanserli";
  const tumorPct = Math.round(result.tumor_probability * 100);

  return (
    <div className={`result ${isTumor ? "tumor" : "healthy"}`}>
      <div className="result-label">
        {isTumor ? "🔴 Kanserli (Metastaz)" : "🟢 Sağlıklı"}
      </div>
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

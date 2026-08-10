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
    </div>
  );
}

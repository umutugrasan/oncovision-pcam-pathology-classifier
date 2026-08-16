import { useState } from "react";
import { raporIndir } from "../rapor.js";
import { useT } from "../i18n.jsx";

export default function SonucKarti({ result, threshold = 0.5, preview }) {
  const t = useT();
  const [hmOpacity, setHmOpacity] = useState(0.6);
  const [pdfLoading, setPdfLoading] = useState(false);

  const pTumor = result.tumor_probability;
  const tumorPct = Math.round(pTumor * 100);
  const thrPct = Math.round(threshold * 100);
  const isTumor = pTumor >= threshold;
  const isUncertain = Math.abs(pTumor - threshold) <= 0.1;
  const unsuitable = result.suitability && result.suitability.suitable === false;

  const stateClass = isUncertain ? "uncertain" : isTumor ? "tumor" : "healthy";
  const label = isUncertain ? t.result.uncertain : isTumor ? t.result.tumor : t.result.healthy;

  async function indir() {
    setPdfLoading(true);
    try {
      await raporIndir({ result, preview, threshold, hmOpacity });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className={`result ${stateClass}`}>
      {unsuitable && (
        <div className="ood-warning">
          🚫 <strong>{t.result.oodTitle}</strong> {t.result.oodReason}
        </div>
      )}
      <div className="result-label">{label}</div>

      {isUncertain && (
        <div className="uncertain-note">{t.result.uncertainNote(tumorPct, thrPct)}</div>
      )}

      <div className="score-row">
        <span>{t.result.tumorProb}</span>
        <strong>{tumorPct}%</strong>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${tumorPct}%` }} />
        <div className="bar-threshold" style={{ left: `${thrPct}%` }} />
      </div>
      <div className="score-detail">
        {t.result.healthyProb}: {Math.round(result.healthy_probability * 100)}% ·{" "}
        {t.result.threshold}: %{thrPct}
        {result.model && ` · ${t.result.model}: ${result.model.toUpperCase()}`}
        {result.tta && ` · ${t.result.ttaOn}`}
      </div>

      {result.heatmap && (
        <div className="heatmap-box">
          <div className="heatmap-title">{t.result.gradcamTitle}</div>
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
            <span>{t.result.opacity}</span>
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
          <div className="heatmap-hint">{t.result.gradcamHint}</div>
        </div>
      )}

      <button className="pdf-btn" onClick={indir} disabled={pdfLoading}>
        {pdfLoading ? t.result.pdfLoading : t.result.pdf}
      </button>
    </div>
  );
}

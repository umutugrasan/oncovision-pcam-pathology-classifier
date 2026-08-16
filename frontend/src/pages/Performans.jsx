import { useState, useEffect } from "react";
import CizgiGrafik from "../components/CizgiGrafik.jsx";
import { useT } from "../i18n.jsx";

export default function Performans() {
  const t = useT();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(false);
  const [model, setModel] = useState("resnet18");

  useEffect(() => {
    fetch("/metrics.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMetrics)
      .catch(() => setError(true));
  }, []);

  if (error)
    return (
      <div className="page">
        <div className="card">{t.perf.missing}</div>
      </div>
    );

  if (!metrics)
    return (
      <div className="page">
        <div className="card">{t.perf.loading}</div>
      </div>
    );

  const m = metrics[model];
  const names = Object.keys(metrics);
  const c = m.confusion;
  const rocPts = m.roc.fpr.map((x, i) => [x, m.roc.tpr[i]]);
  const prPts = m.pr.recall.map((x, i) => [x, m.pr.precision[i]]);
  const relPts = (rel) =>
    rel.conf.map((cf, i) => [cf, rel.acc[i]]).filter(([, a]) => a !== null);

  return (
    <div className="page wide">
      <header className="header">
        <h1>{t.perf.title}</h1>
        <p className="subtitle">{t.perf.subtitle(m.n)}</p>
      </header>

      <div className="model-select" style={{ justifyContent: "center" }}>
        <span className="model-select-label">{t.perf.model}</span>
        <div className="model-options">
          {names.map((n) => (
            <button
              key={n}
              className={`model-btn ${model === n ? "active" : ""}`}
              onClick={() => setModel(n)}
            >
              {n.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="metric-tiles">
          <Tile label={t.perf.accuracy} value={`%${(m.accuracy * 100).toFixed(1)}`} />
          <Tile label="Precision" value={m.precision.toFixed(3)} />
          <Tile label="Recall" value={m.recall.toFixed(3)} />
          <Tile label="F1" value={m.f1.toFixed(3)} />
          <Tile label="ROC-AUC" value={m.roc.auc.toFixed(3)} />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">{t.perf.cmTitle}</h2>
        <table className="cm">
          <thead>
            <tr><th></th><th>{t.perf.cmPredHealthy}</th><th>{t.perf.cmPredTumor}</th></tr>
          </thead>
          <tbody>
            <tr><th>{t.perf.cmRealHealthy}</th><td className="tn">{c.tn}</td><td className="fp">{c.fp}</td></tr>
            <tr><th>{t.perf.cmRealTumor}</th><td className="fn">{c.fn}</td><td className="tp">{c.tp}</td></tr>
          </tbody>
        </table>
        <p className="cm-hint">{t.perf.cmHint(c.fn)}</p>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h2 className="card-title">{t.perf.roc} (AUC = {m.roc.auc})</h2>
          <CizgiGrafik series={[{ points: rocPts, color: "#e23c74" }]} diagonal xlabel={t.perf.rocX} ylabel={t.perf.rocY} />
        </div>
        <div className="card">
          <h2 className="card-title">{t.perf.pr} (AP = {m.pr.ap})</h2>
          <CizgiGrafik series={[{ points: prPts, color: "#16a34a" }]} xlabel="Recall" ylabel="Precision" />
        </div>
        <div className="card">
          <h2 className="card-title">{t.perf.relTitle}</h2>
          <CizgiGrafik
            series={[
              { points: relPts(m.reliability.before), color: "#ef4444" },
              { points: relPts(m.reliability.after), color: "#16a34a" },
            ]}
            diagonal
            xlabel={t.perf.relX}
            ylabel={t.perf.relY}
          />
          <p className="cm-hint">{t.perf.relHint(m.reliability.before.ece, m.reliability.after.ece)}</p>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

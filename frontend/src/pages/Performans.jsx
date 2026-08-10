import { useState, useEffect } from "react";
import CizgiGrafik from "../components/CizgiGrafik.jsx";

export default function Performans() {
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
        <div className="card">
          Metrik dosyası bulunamadı. <code>compute_metrics.py</code> çalıştırılmalı.
        </div>
      </div>
    );

  if (!metrics) return <div className="page"><div className="card">Yükleniyor…</div></div>;

  const m = metrics[model];
  const names = Object.keys(metrics);
  const c = m.confusion;

  // ROC / PR nokta dizilerini [x,y] çiftlerine çevir
  const rocPts = m.roc.fpr.map((x, i) => [x, m.roc.tpr[i]]);
  const prPts = m.pr.recall.map((x, i) => [x, m.pr.precision[i]]);

  // Reliability: null olmayan binleri (conf, acc) çiftine çevir
  const relPts = (rel) =>
    rel.conf.map((cf, i) => [cf, rel.acc[i]]).filter(([, a]) => a !== null);

  return (
    <div className="page wide">
      <header className="header">
        <h1>Model Performansı</h1>
        <p className="subtitle">Test seti ({m.n} örnek) · kalibre olasılıklar</p>
      </header>

      <div className="model-select" style={{ justifyContent: "center" }}>
        <span className="model-select-label">Model:</span>
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

      {/* Özet metrikler */}
      <div className="card">
        <div className="metric-tiles">
          <Tile label="Doğruluk" value={`%${(m.accuracy * 100).toFixed(1)}`} />
          <Tile label="Precision" value={m.precision.toFixed(3)} />
          <Tile label="Recall" value={m.recall.toFixed(3)} />
          <Tile label="F1" value={m.f1.toFixed(3)} />
          <Tile label="ROC-AUC" value={m.roc.auc.toFixed(3)} />
        </div>
      </div>

      {/* Confusion matrix */}
      <div className="card">
        <h2 className="card-title">Karışıklık Matrisi (eşik 0.5)</h2>
        <table className="cm">
          <thead>
            <tr><th></th><th>Tahmin: Sağlıklı</th><th>Tahmin: Kanserli</th></tr>
          </thead>
          <tbody>
            <tr><th>Gerçek: Sağlıklı</th><td className="tn">{c.tn}</td><td className="fp">{c.fp}</td></tr>
            <tr><th>Gerçek: Kanserli</th><td className="fn">{c.fn}</td><td className="tp">{c.tp}</td></tr>
          </tbody>
        </table>
        <p className="cm-hint">
          🔴 Sol-alt (FN={c.fn}) = kaçırılan kanserler — tıbbi olarak en kritik hata.
        </p>
      </div>

      {/* Grafikler */}
      <div className="chart-grid">
        <div className="card">
          <h2 className="card-title">ROC Eğrisi (AUC = {m.roc.auc})</h2>
          <CizgiGrafik
            series={[{ points: rocPts, color: "#6366f1" }]}
            diagonal
            xlabel="Yanlış Pozitif Oranı"
            ylabel="Doğru Pozitif Oranı"
          />
        </div>

        <div className="card">
          <h2 className="card-title">Precision-Recall (AP = {m.pr.ap})</h2>
          <CizgiGrafik
            series={[{ points: prPts, color: "#22c55e" }]}
            xlabel="Recall"
            ylabel="Precision"
          />
        </div>

        <div className="card">
          <h2 className="card-title">Kalibrasyon (Reliability)</h2>
          <CizgiGrafik
            series={[
              { points: relPts(m.reliability.before), color: "#ef4444" },
              { points: relPts(m.reliability.after), color: "#22c55e" },
            ]}
            diagonal
            xlabel="Güven"
            ylabel="Gerçek İsabet"
          />
          <p className="cm-hint">
            🔴 Kalibrasyon öncesi (ECE {m.reliability.before.ece}) ·
            🟢 sonrası (ECE {m.reliability.after.ece}). Kesikli çizgiye yakın =
            daha dürüst güven.
          </p>
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

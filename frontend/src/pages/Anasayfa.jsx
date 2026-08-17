import { useState, useEffect } from "react";
import YuklemeAlani from "../components/YuklemeAlani.jsx";
import SonucKarti from "../components/SonucKarti.jsx";
import RibbonDna from "../components/RibbonDna.jsx";
import { useT } from "../i18n.jsx";

// API tabanı: yerelde nginx/vite proxy için "/api", tek-servis derlemesinde ""
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const API_URL = `${API_BASE}/predict`;
const MODELS_URL = `${API_BASE}/models`;

// Model butonlarinda gosterilecek okunur adlar
const MODEL_LABELS = { cnn: "Özel CNN", resnet18: "ResNet18", resnet50: "ResNet50" };

export default function Anasayfa() {
  const t = useT();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(0.5);
  const [models, setModels] = useState(["cnn"]);
  const [selectedModel, setSelectedModel] = useState("cnn");
  const [useTta, setUseTta] = useState(false);

  const SAMPLES = [
    { src: "/samples/ornek-kanserli-1.png", label: t.tool.sampleTumor },
    { src: "/samples/ornek-kanserli-2.png", label: t.tool.sampleTumor },
    { src: "/samples/ornek-saglikli-1.png", label: t.tool.sampleHealthy },
    { src: "/samples/ornek-saglikli-2.png", label: t.tool.sampleHealthy },
    { src: "/samples/ornek-belirsiz.png", label: t.tool.sampleBorderline },
  ];

  useEffect(() => {
    fetch(MODELS_URL)
      .then((r) => r.json())
      .then((d) => {
        if (d.models?.length) {
          setModels(d.models);
          setSelectedModel(d.models[0]);
        }
      })
      .catch(() => {});
  }, []);

  function handleSelect(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  function yeniAnaliz() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function loadSample(src, name) {
    try {
      const blob = await (await fetch(src)).blob();
      const f = new File([blob], name, { type: "image/png" });
      handleSelect(f);
      analyze(f);
    } catch {
      setError("Örnek görsel yüklenemedi.");
    }
  }

  async function analyze(fileArg) {
    const theFile = fileArg || file;
    if (!theFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", theFile);
      form.append("model", selectedModel);
      form.append("tta", useTta);
      const res = await fetch(API_URL, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Sunucu hatası (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-text">
          <span className="hero-badge">
            <span className="hero-dot" aria-hidden /> {t.hero.badge}
          </span>
          <h1>{t.hero.title}</h1>
          <p className="hero-desc">{t.hero.desc}</p>
        </div>
        <div className="hero-art">
          <RibbonDna />
        </div>
      </section>

      <main className="card tool-card">
        {models.length > 1 && (
          <div className="model-select">
            <span className="model-select-label">{t.tool.model}</span>
            <div className="model-options">
              {models.map((m) => (
                <button
                  key={m}
                  className={`model-btn ${selectedModel === m ? "active" : ""}`}
                  onClick={() => setSelectedModel(m)}
                  disabled={loading}
                >
                  {MODEL_LABELS[m] || m.toUpperCase()}
                  {m === "cnn" && <span className="best-badge">★ en iyi</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <YuklemeAlani
          preview={preview}
          onSelect={handleSelect}
          analyzing={loading}
        />

        {file && <p className="filename">📎 {file.name}</p>}

        {!result && !file && (
          <div className="samples">
            <div className="samples-title">{t.tool.samplesTitle}</div>
            <div className="samples-row">
              {SAMPLES.map((s) => (
                <button
                  key={s.src}
                  className="sample-thumb"
                  onClick={() => loadSample(s.src, s.src.split("/").pop())}
                  title={s.label}
                  disabled={loading}
                >
                  <img src={s.src} alt={s.label} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!result && !loading && (
          <label className="tta-toggle">
            <input
              type="checkbox"
              checked={useTta}
              onChange={(e) => setUseTta(e.target.checked)}
            />
            <span>{t.tool.tta}</span>
          </label>
        )}

        {!result && (
          <button className="analyze-btn" onClick={() => analyze()} disabled={!file || loading}>
            {loading ? t.tool.analyzing : t.tool.analyze}
          </button>
        )}

        {error && <div className="error">⚠️ {error}</div>}
        {result && (
          <SonucKarti result={result} threshold={threshold} preview={preview} />
        )}

        {result && (
          <div className="threshold-box">
            <div className="threshold-row">
              <span>{t.threshold.label}</span>
              <strong>{Math.round(threshold * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0.3"
              max="0.7"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="threshold-slider"
            />
            <div className="threshold-hint">{t.threshold.hint}</div>
          </div>
        )}

        {result && (
          <button className="analyze-btn secondary" onClick={yeniAnaliz}>
            {t.tool.newAnalysis}
          </button>
        )}
      </main>

      <footer className="disclaimer">
        <strong>{t.disclaimer.strong}</strong>
        {t.disclaimer.text}
      </footer>
    </div>
  );
}

import { useState, useEffect } from "react";
import YuklemeAlani from "../components/YuklemeAlani.jsx";
import SonucKarti from "../components/SonucKarti.jsx";

// Geliştirmede vite proxy '/api' -> localhost:8000'e yönlendirir.
// API tabanı: yerelde nginx/vite proxy için "/api", tek-servis (HF) derlemesinde ""
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const API_URL = `${API_BASE}/predict`;
const MODELS_URL = `${API_BASE}/models`;

// Arayüzde hazır örnek görseller (frontend/public/samples/)
const SAMPLES = [
  { src: "/samples/ornek-kanserli-1.png", label: "Kanserli örnek" },
  { src: "/samples/ornek-kanserli-2.png", label: "Kanserli örnek" },
  { src: "/samples/ornek-saglikli-1.png", label: "Sağlıklı örnek" },
  { src: "/samples/ornek-saglikli-2.png", label: "Sağlıklı örnek" },
  { src: "/samples/ornek-belirsiz.png", label: "Sınırda örnek" },
];

export default function Anasayfa() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(0.5); // karar eşiği (kanser deme sınırı)
  const [models, setModels] = useState(["resnet18"]);
  const [selectedModel, setSelectedModel] = useState("resnet18");
  const [useTta, setUseTta] = useState(false); // test-time augmentation

  // Kullanılabilir modelleri backend'den çek
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

  // Örnek görseli indir, seç ve otomatik analiz et
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
      <header className="header">
        <h1>Patoloji Görseli Analizi</h1>
        <p className="subtitle">
          ResNet18 · Lenf düğümünde metastatik meme kanseri tespiti
        </p>
      </header>

      <main className="card">
        {!result && models.length > 1 && (
          <div className="model-select">
            <span className="model-select-label">Model:</span>
            <div className="model-options">
              {models.map((m) => (
                <button
                  key={m}
                  className={`model-btn ${selectedModel === m ? "active" : ""}`}
                  onClick={() => setSelectedModel(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <YuklemeAlani preview={preview} onSelect={handleSelect} />

        {file && <p className="filename">📎 {file.name}</p>}

        {!result && (
          <label className="tta-toggle">
            <input
              type="checkbox"
              checked={useTta}
              onChange={(e) => setUseTta(e.target.checked)}
            />
            <span>
              Test-time augmentation (4 yönde ortalama — daha kararlı, biraz yavaş)
            </span>
          </label>
        )}

        {!result && !file && (
          <div className="samples">
            <div className="samples-title">
              Görselin yok mu? Hazır bir örnek dene:
            </div>
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

        {!result && (
          <button className="analyze-btn" onClick={() => analyze()} disabled={!file || loading}>
            {loading ? "Analiz ediliyor…" : "Analiz Et"}
          </button>
        )}

        {error && <div className="error">⚠️ {error}</div>}
        {result && (
          <SonucKarti result={result} threshold={threshold} preview={preview} />
        )}

        {result && (
          <div className="threshold-box">
            <div className="threshold-row">
              <span>Karar eşiği (kanser deme sınırı)</span>
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
            <div className="threshold-hint">
              ⬅ Düşük eşik: daha duyarlı, kanseri kaçırma azalır (recall ↑) ·
              Yüksek eşik: daha temkinli, yanlış alarm azalır (precision ↑) ➡
            </div>
          </div>
        )}

        {result && (
          <button className="analyze-btn secondary" onClick={yeniAnaliz}>
            ↺ Yeni Analiz
          </button>
        )}
      </main>

      <footer className="disclaimer">
        <strong>⚠️ Yasal Uyarı:</strong> Bu araç yalnızca <b>araştırma ve
        eğitim</b> amaçlıdır ve <b>klinik tanı için kullanılamaz</b>. Model
        sadece H&amp;E boyalı lenf düğümü patch'leri (PCam) için anlamlıdır;
        başka doku/organ görsellerinde sonuçlar geçersizdir. Nihai tanı her
        zaman uzman patolog tarafından konulmalıdır.
      </footer>
    </div>
  );
}

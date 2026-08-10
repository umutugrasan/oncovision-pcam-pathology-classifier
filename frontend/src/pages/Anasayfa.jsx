import { useState } from "react";
import YuklemeAlani from "../components/YuklemeAlani.jsx";
import SonucKarti from "../components/SonucKarti.jsx";

// Geliştirmede vite proxy '/api' -> localhost:8000'e yönlendirir.
const API_URL = "/api/predict";

export default function Anasayfa() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
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
        <YuklemeAlani preview={preview} onSelect={handleSelect} />

        {file && <p className="filename">📎 {file.name}</p>}

        {!result && (
          <button className="analyze-btn" onClick={analyze} disabled={!file || loading}>
            {loading ? "Analiz ediliyor…" : "Analiz Et"}
          </button>
        )}

        {error && <div className="error">⚠️ {error}</div>}
        {result && <SonucKarti result={result} />}

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

import { useRef, useState } from "react";
import { useT } from "../i18n.jsx";

/**
 * Sürükle-bırak / tıkla-seç görsel yükleme alanı.
 * analyzing=true iken görselin üzerinde "scanline" tarama animasyonu gösterilir.
 */
export default function YuklemeAlani({ preview, onSelect, analyzing = false }) {
  const t = useT();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    onSelect(e.dataTransfer.files?.[0]);
  }

  return (
    <div
      className={`dropzone ${dragOver ? "over" : ""} ${preview ? "has-image" : ""}`}
      onClick={() => !analyzing && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {preview ? (
        <>
          <img src={preview} alt="önizleme" className="preview" />
          {analyzing && (
            <div className="scan-overlay">
              <div className="scanline" />
              <div className="scan-spinner" />
              <span className="scan-text">{t.tool.scanText}</span>
            </div>
          )}
        </>
      ) : (
        <div className="dz-empty">
          <div className="dz-icon">🔬</div>
          <p>{t.tool.dropTitle}</p>
          <p className="dz-hint">{t.tool.dropHint}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/tiff,image/bmp"
        hidden
        onChange={(e) => onSelect(e.target.files?.[0])}
      />
    </div>
  );
}

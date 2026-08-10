import { useRef, useState } from "react";

/**
 * Sürükle-bırak / tıkla-seç görsel yükleme alanı.
 * props:
 *   preview  -> önizleme URL'i (string | null)
 *   onSelect -> seçilen File'ı üst bileşene bildirir
 */
export default function YuklemeAlani({ preview, onSelect }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    onSelect(e.dataTransfer.files?.[0]);
  }

  return (
    <div
      className={`dropzone ${dragOver ? "over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {preview ? (
        <img src={preview} alt="önizleme" className="preview" />
      ) : (
        <div className="dz-empty">
          <div className="dz-icon">🖼️</div>
          <p>Patoloji görselini sürükle-bırak</p>
          <p className="dz-hint">veya tıklayıp seç (PNG / JPG / TIFF)</p>
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

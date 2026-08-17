import { useEffect, useRef, useState } from "react";

/**
 * Kurdele şeklinde, dönen pembe DNA.
 * Bir farkındalık kurdelesi yolunu (SVG path) örnekler; her örnek noktaya,
 * yola dik yerleşen ve Y ekseninde dönen bir DNA baz çifti koyar. Ardışık
 * bazlar faz kaymalı → kurdeleyi izleyen, dönen çift sarmal.
 */
// Kendisiyle çaprazlanan farkındalık kurdelesi: üstte kısa döngü, altta UZUN
// çapraz kuyruklar (viewBox 260x380). Bead'ler kuyrukları doldurur.
// Döngü kontrol noktaları (…196 66 … / … 64 66 …) AYNI kalır (aralık korunur);
// yalnızca kuyruk uçları aşağı uzatıldı (viewBox 260x440).
const PATH = "M78 424 C 200 172 196 66 130 42 C 64 66 60 172 182 424";
const N = 46;

export default function RibbonDna() {
  const pathRef = useRef(null);
  const [rungs, setRungs] = useState([]);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    const arr = [];
    // Sadece tam uç noktayı atla; bead'ler kuyruk uçlarına kadar dolsun
    for (let i = 1; i < N - 1; i++) {
      const d = (i / (N - 1)) * len;
      const pt = p.getPointAtLength(d);
      const pt2 = p.getPointAtLength(Math.min(d + 1.5, len));
      const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      arr.push({ x: pt.x, y: pt.y, ang, i });
    }
    setRungs(arr);
  }, []);

  return (
    <div className="rdna" aria-hidden>
      <svg viewBox="0 0 260 440" className="rdna-svg">
        <path ref={pathRef} d={PATH} fill="none" stroke="none" />
      </svg>
      <div className="rdna-rungs">
        {rungs.map((r) => (
          <div
            key={r.i}
            className="rdna-rung"
            style={{
              left: `${(r.x / 260) * 100}%`,
              top: `${(r.y / 440) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${r.ang + 90}deg)`,
            }}
          >
            <div className="rdna-bar" style={{ animationDelay: `${(-r.i * 0.13).toFixed(2)}s` }}>
              <span className={`rdna-node ${r.i % 2 ? "alt" : ""}`} />
              <span className={`rdna-node right ${r.i % 2 ? "alt" : ""}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

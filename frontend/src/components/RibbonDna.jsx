import { useEffect, useRef, useState } from "react";

/**
 * Kurdele şeklinde, dönen pembe DNA.
 * Bir farkındalık kurdelesi yolunu (SVG path) örnekler; her örnek noktaya,
 * yola dik yerleşen ve Y ekseninde dönen bir DNA baz çifti koyar. Ardışık
 * bazlar faz kaymalı → kurdeleyi izleyen, dönen çift sarmal.
 */
// Kendisiyle çaprazlanan (X yapan) farkındalık kurdelesi yolu:
// sol kuyruk -> sağ taraftan yukarı -> tepe döngü -> sol taraftan aşağı -> sağ kuyruk
const PATH = "M104 292 C 178 205 170 112 130 96 C 90 112 82 205 156 292";
const N = 30;

export default function RibbonDna() {
  const pathRef = useRef(null);
  const [rungs, setRungs] = useState([]);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    const arr = [];
    for (let i = 0; i < N; i++) {
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
      <svg viewBox="0 0 260 300" className="rdna-svg">
        <path ref={pathRef} d={PATH} fill="none" stroke="rgba(255,92,138,0.18)" strokeWidth="1.5" />
      </svg>
      <div className="rdna-rungs">
        {rungs.map((r) => (
          <div
            key={r.i}
            className="rdna-rung"
            style={{
              left: `${(r.x / 260) * 100}%`,
              top: `${(r.y / 300) * 100}%`,
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

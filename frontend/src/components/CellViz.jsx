/**
 * Landing için organik, animasyonlu "hücre" görseli.
 * SVG goo + fiber displacement filtreleri, nefes alan membran, bölünen yavru
 * hücre, fiber doku ve sheen katmanları + süzülen porlar. Tamamen CSS/SVG.
 */
const BUBBLES = Array.from({ length: 20 }, (_, i) => {
  const size = 4 + ((i * 7) % 15);
  return {
    size,
    top: (i * 37) % 90,
    left: (i * 53) % 86,
    dur: 7 + ((i * 3) % 10),
    delay: (i % 8) * 0.7,
  };
});

const FILTER_DEFS = `
<defs>
  <filter id="cellGoo" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
    <feComposite in="SourceGraphic" in2="goo" operator="atop" />
  </filter>
  <filter id="cellFiber" x="-40%" y="-40%" width="180%" height="180%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.05" numOctaves="3" seed="7" result="noise">
      <animate attributeName="baseFrequency" values="0.006 0.045;0.009 0.06;0.006 0.045" dur="14s" repeatCount="indefinite" />
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="34" xChannelSelector="R" yChannelSelector="G" />
  </filter>
  <filter id="cellFiberTex" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.11" numOctaves="4" seed="5" result="n">
      <animate attributeName="baseFrequency" values="0.01 0.1;0.014 0.13;0.01 0.1" dur="11s" repeatCount="indefinite" />
    </feTurbulence>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.55 0.55 0.55 0 0" />
  </filter>
</defs>`;

export default function CellViz() {
  return (
    <div className="cell-viz" aria-hidden>
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        dangerouslySetInnerHTML={{ __html: FILTER_DEFS }}
      />
      <div className="cell-orb">
        <div className="cell-breathe">
          <div className="cell-main" />
          <div className="cell-daughter" />
        </div>
        <div className="cell-fiber-tex" />
        <div className="cell-overlay" />
        <div className="cell-sheen" />
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="cell-bubble"
            style={{
              width: b.size,
              height: b.size,
              top: `${b.top}%`,
              left: `${b.left}%`,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

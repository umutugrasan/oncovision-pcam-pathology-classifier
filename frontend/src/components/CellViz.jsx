/**
 * Landing için temiz, ışıltılı "hücre" görseli:
 * yumuşak membran küresi + çekirdek/çekirdekçik + organeller + süzülen
 * kabarcıklar. Nazik nefes alma ve yavaş dönme. Tamamen CSS/SVG.
 */
const BUBBLES = Array.from({ length: 16 }, (_, i) => {
  const size = 4 + ((i * 7) % 12);
  return {
    size,
    top: 12 + ((i * 41) % 74),
    left: 12 + ((i * 57) % 72),
    dur: 8 + ((i * 3) % 9),
    delay: (i % 8) * 0.8,
  };
});

// hücre içi organeller (küçük, hafif)
const ORGANELLES = [
  { s: 26, t: 58, l: 24 },
  { s: 18, t: 66, l: 60 },
  { s: 14, t: 30, l: 66 },
  { s: 12, t: 48, l: 46 },
];

export default function CellViz() {
  return (
    <div className="cell-viz" aria-hidden>
      <div className="cell-orb">
        <div className="cell-membrane">
          <div className="cell-cytoplasm" />
          {ORGANELLES.map((o, i) => (
            <span
              key={i}
              className="cell-organelle"
              style={{ width: `${o.s}%`, height: `${o.s}%`, top: `${o.t}%`, left: `${o.l}%` }}
            />
          ))}
          <div className="cell-nucleus">
            <div className="cell-nucleolus" />
          </div>
          <div className="cell-sheen" />
        </div>
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

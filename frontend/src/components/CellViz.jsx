/**
 * Landing için stilize, animasyonlu "hücre" görseli:
 * yumuşak membranlı büyük bir küre + süzülen kabarcıklar. Tamamen CSS/SVG.
 */
const BUBBLES = Array.from({ length: 22 }, (_, i) => {
  const size = 4 + ((i * 7) % 16);
  return {
    size,
    top: (i * 37) % 92,
    left: (i * 53) % 90,
    dur: 7 + ((i * 3) % 10),
    delay: (i % 8) * 0.7,
  };
});

export default function CellViz() {
  return (
    <div className="cell-viz" aria-hidden>
      <div className="cell-orb">
        <div className="cell-core" />
        <div className="cell-ring" />
        <div className="cell-ring cell-ring-2" />
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

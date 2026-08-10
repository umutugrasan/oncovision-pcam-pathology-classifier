/**
 * Basit SVG çizgi grafiği (harici kütüphane yok).
 * props:
 *   series   -> [{ points: [[x,y],...], color, label }]  (x,y 0..1 arası)
 *   diagonal -> true ise y=x referans çizgisi
 *   xlabel, ylabel
 */
export default function CizgiGrafik({ series, diagonal = false, xlabel, ylabel }) {
  const W = 300;
  const H = 260;
  const pad = 40;
  const iw = W - pad * 2;
  const ih = H - pad * 2;

  // 0..1 değeri -> SVG koordinatı (y ters)
  const sx = (x) => pad + x * iw;
  const sy = (y) => pad + (1 - y) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
      {/* ızgara */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(1)} className="grid" />
          <line x1={sx(0)} y1={sy(t)} x2={sx(1)} y2={sy(t)} className="grid" />
          <text x={sx(t)} y={sy(0) + 14} className="tick" textAnchor="middle">
            {t}
          </text>
          <text x={sx(0) - 6} y={sy(t) + 3} className="tick" textAnchor="end">
            {t}
          </text>
        </g>
      ))}

      {/* eksenler */}
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} className="axis" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(1)} className="axis" />

      {diagonal && (
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="diagonal" />
      )}

      {series.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
        />
      ))}

      {xlabel && (
        <text x={W / 2} y={H - 4} className="axis-label" textAnchor="middle">
          {xlabel}
        </text>
      )}
      {ylabel && (
        <text
          x={12}
          y={H / 2}
          className="axis-label"
          textAnchor="middle"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          {ylabel}
        </text>
      )}
    </svg>
  );
}

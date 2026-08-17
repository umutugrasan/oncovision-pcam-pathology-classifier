import { useT } from "../i18n.jsx";

export default function Hakkinda() {
  const t = useT();
  return (
    <div className="page">
      <header className="header">
        <h1>{t.about.title}</h1>
        <p className="subtitle">{t.about.subtitle}</p>
      </header>

      <main className="card prose">
        <h2>{t.about.h2model}</h2>
        <p>{t.about.pModel}</p>

        <h2>{t.about.h2tech}</h2>
        <ul>
          <li>{t.about.tech1}</li>
          <li>{t.about.tech2}</li>
          <li>{t.about.tech3}</li>
        </ul>

        <h2>{t.about.h2perf}</h2>
        <table className="metrics">
          <tbody>
            <tr><td>{t.perf.accuracy}</td><td>%85.43</td></tr>
            <tr><td>Precision</td><td>0.9690</td></tr>
            <tr><td>Recall</td><td>0.7318</td></tr>
            <tr><td>F1-Score</td><td>0.8339</td></tr>
          </tbody>
        </table>

        <h2>{t.about.h2calib}</h2>
        <p>{t.about.pCalib}</p>

        <div className="warn-box">{t.about.warn}</div>

        <div className="credit">
          <span>{t.about.credit}: <strong>Umut Uğraşan</strong></span>
          <a href="https://github.com/umutugrasan" target="_blank" rel="noreferrer">
            github.com/umutugrasan ↗
          </a>
        </div>
      </main>
    </div>
  );
}

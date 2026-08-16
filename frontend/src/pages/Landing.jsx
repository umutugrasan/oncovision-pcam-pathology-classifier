import { Link } from "react-router-dom";
import DnaViz from "../components/DnaViz.jsx";
import { useT, useLang } from "../i18n.jsx";

const GITHUB = "https://github.com/umutugrasan/pcam-pathology-classifier";

export default function Landing() {
  const t = useT();
  const { lang, setLang } = useLang();

  // menü hedefleri: [araç, performans, hakkında, iletişim(GitHub)]
  const targets = ["/analiz", "/performans", "/hakkinda", GITHUB];

  return (
    <div className="landing">
      <header className="landing-top">
        <div className="landing-logo">
          <img src="/logo.png" alt="OncoVision" className="landing-logo-img" />
        </div>
        <button className="lang-toggle dark" onClick={() => setLang(lang === "tr" ? "en" : "tr")}>
          {lang === "tr" ? "EN" : "TR"}
        </button>
      </header>

      <div className="landing-body">
        <nav className="landing-menu">
          {t.landing.items.map((label, i) => {
            const to = targets[i];
            const cls = `menu-item ${i === 0 ? "active" : ""}`;
            const inner = (
              <>
                <span className="menu-num">0{i + 1}</span>
                <span className="menu-label">{label}</span>
              </>
            );
            return to.startsWith("http") ? (
              <a key={label} href={to} target="_blank" rel="noreferrer" className={cls}>
                {inner}
              </a>
            ) : (
              <Link key={label} to={to} className={cls}>
                {inner}
              </Link>
            );
          })}
          <p className="landing-desc">{t.landing.desc}</p>

          <Link to="/analiz" className="landing-cta">
            {t.landing.cta} →
          </Link>
        </nav>

        <DnaViz />
      </div>

      <footer className="landing-footer">
        <p className="landing-legal">{t.landing.disclaimer}</p>
        <span className="landing-rights">{t.landing.rights}</span>
      </footer>
    </div>
  );
}

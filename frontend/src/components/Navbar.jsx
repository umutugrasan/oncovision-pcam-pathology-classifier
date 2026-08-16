import { NavLink } from "react-router-dom";
import { useT, useLang } from "../i18n.jsx";

export default function Navbar() {
  const t = useT();
  const { lang, setLang } = useLang();

  return (
    <nav className="navbar">
      <NavLink to="/" className="nav-brand">
        <img src="/logo.png" alt="OncoVision" className="nav-logo" />
      </NavLink>
      <div className="nav-right">
        <div className="nav-links">
          <NavLink to="/analiz" className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.home}
          </NavLink>
          <NavLink to="/performans" className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.performance}
          </NavLink>
          <NavLink to="/hakkinda" className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.about}
          </NavLink>
        </div>
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === "tr" ? "en" : "tr")}
          title="Dil / Language"
        >
          {lang === "tr" ? "EN" : "TR"}
        </button>
      </div>
    </nav>
  );
}

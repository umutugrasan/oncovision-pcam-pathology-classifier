import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-brand">🔬 PCam Sınıflandırıcı</div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Anasayfa
        </NavLink>
        <NavLink to="/hakkinda" className={({ isActive }) => (isActive ? "active" : "")}>
          Hakkında
        </NavLink>
      </div>
    </nav>
  );
}

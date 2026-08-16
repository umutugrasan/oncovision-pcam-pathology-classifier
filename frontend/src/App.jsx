import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "./i18n.jsx";
import Navbar from "./components/Navbar.jsx";
import Landing from "./pages/Landing.jsx";
import Anasayfa from "./pages/Anasayfa.jsx";
import Performans from "./pages/Performans.jsx";
import Hakkinda from "./pages/Hakkinda.jsx";

// Uygulama sayfaları pembe "shell" (navbar + beyaz panel) içinde.
function Shell({ children }) {
  return (
    <div className="shell">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/analiz" element={<Shell><Anasayfa /></Shell>} />
          <Route path="/performans" element={<Shell><Performans /></Shell>} />
          <Route path="/hakkinda" element={<Shell><Hakkinda /></Shell>} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}

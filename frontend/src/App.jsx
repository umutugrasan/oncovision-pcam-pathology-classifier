import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Anasayfa from "./pages/Anasayfa.jsx";
import Performans from "./pages/Performans.jsx";
import Hakkinda from "./pages/Hakkinda.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Anasayfa />} />
        <Route path="/performans" element={<Performans />} />
        <Route path="/hakkinda" element={<Hakkinda />} />
      </Routes>
    </BrowserRouter>
  );
}

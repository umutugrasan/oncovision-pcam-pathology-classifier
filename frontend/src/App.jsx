import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Anasayfa from "./pages/Anasayfa.jsx";
import Hakkinda from "./pages/Hakkinda.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Anasayfa />} />
        <Route path="/hakkinda" element={<Hakkinda />} />
      </Routes>
    </BrowserRouter>
  );
}

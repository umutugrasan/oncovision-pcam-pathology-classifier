import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Geliştirme sırasında /api isteklerini backend'e (localhost:8000) yönlendir.
// Böylece frontend kodunda tam URL yazmana gerek kalmaz.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});

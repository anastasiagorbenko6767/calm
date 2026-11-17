import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = { "/api": "http://127.0.0.1:3001" };

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, proxy: api },
  preview: { host: "127.0.0.1", port: 4173, proxy: api },
});

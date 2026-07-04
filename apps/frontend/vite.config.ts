import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "NOVA-App",
        short_name: "NOVA",
        theme_color: "#0a0e27",
        display: "standalone"
      }
    })
  ]
});

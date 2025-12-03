import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,

    // Disable HMR in sandbox to avoid WebSocket connection issues
    // The preview will still work, just won't auto-refresh
    hmr: false,

    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ["**/node_modules/**", "**/.git/**"],
    },
  },
})
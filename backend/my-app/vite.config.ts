import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const host = process.env.VITE_DEV_SERVER_HMR_HOST || "localhost";
  return {
    plugins: [react(), tailwindcss()],
    
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: [".e2b.app"],
      cors: true,
      hmr: {
        host,
        protocol: "wss",
        clientPort: 443,
      },
    },
  };
});

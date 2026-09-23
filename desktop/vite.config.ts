import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const apiUrl = process.env.VITE_API_URL || (process.env.TAURI_ENV_DEBUG ? "http://localhost:3001" : "https://api.wyst.lol");
const webUrl = process.env.VITE_WEB_URL || (process.env.TAURI_ENV_DEBUG ? "http://localhost:3000" : "https://wyst.lol");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "lucide-react", "clsx", "tailwind-merge", "ogl"],
  },
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(apiUrl),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || (process.env.TAURI_ENV_DEBUG ? "development" : "production")),
    "process.env": "{}",
    __WYST_WEB_URL__: JSON.stringify(webUrl),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        notification: fileURLToPath(new URL("./notification.html", import.meta.url)),
      },
    },
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});

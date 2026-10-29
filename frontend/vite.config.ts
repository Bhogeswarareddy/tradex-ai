import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

function getBackendUrl(): string {
  if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL;
  try {
    const ip = execSync("wsl hostname -I", { encoding: "utf8" }).trim().split(/\s+/)[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return `http://${ip}:8000`;
    }
  } catch {
    // ignore
  }
  return "http://127.0.0.1:8000";
}

const backendUrl = getBackendUrl();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  // @ts-expect-error - Vitest config in Vite defineConfig
  test: {
    include: ["src/tests/**/*.{test,spec}.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});

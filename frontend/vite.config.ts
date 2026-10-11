import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
        target: process.env.VITE_BACKEND_URL || "http://backend:8000",
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

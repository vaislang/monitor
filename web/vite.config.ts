import { defineConfig } from "vite";
import { vaisxPlugin } from "./vite-plugin-vaisx";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vaisxPlugin()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
    extensions: [".ts", ".js", ".vaisx", ".vais", ".json"],
  },

  server: {
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      // Proxy API calls to the Vais backend during development
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },

  // Allow importing locales JSON files
  assetsInclude: ["**/*.json"],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "chrome-extension/dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "chrome-extension/sidepanel.html"),
      },
      plugins: [
        visualizer({
          filename: "chrome-extension/dist/bundle-report.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
        }),
      ],
    },
  },
});

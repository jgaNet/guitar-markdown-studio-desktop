import { defineConfig } from "vite";

// GitHub Pages serves project pages under /<repo-name>/, so the Pages build
// sets GMS_BASE_PATH to that prefix. The Electron desktop build loads dist/
// via a file:// URL instead, so it must keep the default root base.
export default defineConfig({
  base: process.env.GMS_BASE_PATH || "/",
});

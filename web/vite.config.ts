import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/casamento/",
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), admin: resolve(__dirname, "admin.html") },
    },
  },
});

import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve("index.html"),
        tax: resolve("apps/tax/index.html"),
        it: resolve("apps/it/index.html"),
      },
    },
  },
});

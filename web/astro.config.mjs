import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@/": new URL("./src/common/", import.meta.url).pathname,
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          loadPaths: ["."],
        },
      },
    },
  },
});

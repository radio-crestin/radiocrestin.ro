import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  integrations: [react()],
  image: {
    domains: ["fsn1.your-objectstorage.com"],
  },
  vite: {
    environments: {
      client: {
        build: {
          sourcemap: "hidden",
        },
      },
    },
    resolve: {
      alias: {
        "@/": new URL("./src/common/", import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      include: ["react-dom/client"],
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

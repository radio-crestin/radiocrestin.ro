import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://www.radiocrestin.ro",
  // The host serves directory-format pages and 308-redirects /x to /x/;
  // canonicals and the sitemap use the trailing-slash form to match.
  trailingSlash: "always",
  output: "static",
  prefetch: false,
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

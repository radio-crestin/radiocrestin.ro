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
      // hls.js is only reached via dynamic import(), so Vite's startup scan
      // misses it; without pre-bundling it gets discovered mid-session and
      // stale tabs hit "504 Outdated Optimize Dep" on the player.
      include: ["react-dom/client", "hls.js"],
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

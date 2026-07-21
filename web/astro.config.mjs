import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://www.radiocrestin.ro",
  // The host serves directory-format pages and 308-redirects /x to /x/;
  // canonicals and the sitemap use the trailing-slash form to match.
  trailingSlash: "always",
  output: "static",
  // Page CSS goes inline in the HTML: as separate files the three per-page
  // stylesheets are render-blocking round-trips (~0.5-0.85s of blank screen
  // on 4G), while the HTML they'd ride in is served max-age=0 regardless.
  build: {
    inlineStylesheets: "always",
  },
  prefetch: false,
  integrations: [react()],
  image: {
    domains: ["fsn1.your-objectstorage.com"],
  },
  vite: {
    plugins: [
      {
        // Dev-only: Vite serves public/*.txt as text/plain without charset,
        // so browsers decode UTF-8 diacritics as Windows-1252. Production
        // (Cloudflare) already sends charset=utf-8.
        name: "txt-charset-utf8",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.split("?")[0].endsWith(".txt")) {
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
            }
            next();
          });
        },
      },
    ],
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

/**
 * Writes dist/_redirects: a permanent (308) redirect from every page's slashless
 * URL to its canonical trailing-slash URL (/radio-gosen -> /radio-gosen/).
 *
 * The Worker's `html_handling: "auto-trailing-slash"` does the same redirect,
 * but as a temporary 307; search engines treat only 301/308 as a move. Cloudflare
 * applies _redirects before serving assets, so these rules win.
 * Run after `astro build`.
 */
const fs = require("node:fs");
const path = require("node:path");

const DIST = path.join(__dirname, "..", "dist");
const MAX_STATIC_RULES = 2000; // Cloudflare's limit for static _redirects rules

function pageDirectories(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .flatMap((entry) => {
      const url = `${prefix}/${entry.name}`;
      const full = path.join(dir, entry.name);
      const own = fs.existsSync(path.join(full, "index.html")) ? [url] : [];
      return [...own, ...pageDirectories(full, url)];
    });
}

const pages = pageDirectories(DIST);
if (pages.length > MAX_STATIC_RULES) {
  throw new Error(`${pages.length} pages exceed ${MAX_STATIC_RULES} static _redirects rules`);
}
const rules = pages.map((url) => `${encodeURI(url)} ${encodeURI(url)}/ 308`);
fs.writeFileSync(path.join(DIST, "_redirects"), rules.join("\n") + "\n");
console.log(`[trailing-slash-redirects] wrote ${rules.length} rules to dist/_redirects`);

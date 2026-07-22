#!/usr/bin/env node
/**
 * Injects <link rel="modulepreload"> hints for every island's static import
 * graph into the built HTML, so the browser downloads all module chunks in one
 * parallel wave instead of discovering them serially (the serial walk costs
 * ~2 extra round-trips before hydration). Runs after `astro build`; the list
 * is recomputed from dist on every build, so it can never go stale.
 *
 * Dynamic imports (e.g. the fallback-stations chunk) are intentionally NOT
 * preloaded — they are lazy on purpose.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");

// Static `import ... from "x"` / `import "x"` / `export ... from "x"` in the
// minified output. Dynamic `import("x")` never matches: the "(" after import
// fits neither the clause group nor a directly-following quote.
const IMPORT_RE =
  /(?:^|[^.\w$])(?:import|export)\s*(?:[\w*{},$\s]+?from\s*)?["']([^"']+)["']/g;

const depsCache = new Map();

function staticDeps(absFile) {
  if (depsCache.has(absFile)) return depsCache.get(absFile);
  const deps = [];
  const code = fs.readFileSync(absFile, "utf8");
  for (const match of code.matchAll(IMPORT_RE)) {
    const spec = match[1];
    let resolved;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      resolved = path.resolve(path.dirname(absFile), spec);
    } else if (spec.startsWith("/")) {
      resolved = path.join(DIST, spec);
    } else {
      continue; // bare/external specifier — nothing to preload
    }
    if (resolved.endsWith(".js") && fs.existsSync(resolved)) {
      deps.push(resolved);
    }
  }
  depsCache.set(absFile, deps);
  return deps;
}

// Breadth-first transitive closure of the static import graph.
function moduleClosure(entryFiles) {
  const seen = new Set();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticDeps(file));
  }
  return [...seen];
}

function htmlFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(dir, f));
}

let pagesTouched = 0;
let totalLinks = 0;

for (const htmlPath of htmlFiles(DIST)) {
  let html = fs.readFileSync(htmlPath, "utf8");

  const entryUrls = [
    ...html.matchAll(/(?:component-url|renderer-url)="([^"]+)"/g),
  ].map((m) => m[1]);
  if (entryUrls.length === 0) continue;

  const entryFiles = [...new Set(entryUrls)]
    .map((u) => path.join(DIST, u))
    .filter((f) => fs.existsSync(f));
  const links = moduleClosure(entryFiles)
    .map((f) => "/" + path.relative(DIST, f).split(path.sep).join("/"))
    .map((u) => `<link rel="modulepreload" href="${u}" fetchpriority="low">`)
    .join("");

  // idempotent: drop any previously injected hints before re-injecting
  html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");
  // Insert EARLY in <head> (right after charset), not before </head>: hints
  // that sit after the ~110KB of build-inlined CSS take Chrome's element path,
  // where fetchpriority on modulepreload is silently ignored and the chunks
  // fetch at High, competing with the LCP image. Early bytes take the
  // speculative-scanner path where "low" is honored (verified empirically).
  const charsetTag = '<meta charset="UTF-8">';
  if (html.includes(charsetTag)) {
    html = html.replace(charsetTag, `${charsetTag}${links}`);
  } else {
    html = html.replace("</head>", `${links}</head>`);
  }
  fs.writeFileSync(htmlPath, html);

  pagesTouched += 1;
  totalLinks += (links.match(/<link/g) || []).length;
}

console.log(
  `[inject-modulepreload] ${pagesTouched} pages, ${totalLinks} links injected (${Math.round(
    totalLinks / Math.max(pagesTouched, 1),
  )} avg/page)`,
);

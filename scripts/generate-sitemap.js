const fs = require("fs");
const path = require("path");

const fallbackData = require("../src/common/data/fallback-stations.json");

const SITE_URL = "https://www.radiocrestin.ro";
const API_URL = "https://api.radiocrestin.ro/api/v1/stations";

const STATIC_PAGES = [
  { path: "", priority: "1.0" },
  { path: "/intrebari-frecvente", priority: "0.8" },
  { path: "/descarca-aplicatia-radio-crestin", priority: "0.8" },
  { path: "/church-hub", priority: "0.7" },
  { path: "/privacy-policy", priority: "0.5" },
  { path: "/terms-of-service", priority: "0.5" },
  { path: "/statistici", priority: "0.5" },
];

async function generateSitemap() {
  console.log("🔄 Generating sitemap...");

  let stations = [];

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    stations = data.data?.stations || [];

    if (stations.length === 0) {
      throw new Error("Empty stations list from API");
    }

    console.log(`📻 Found ${stations.length} stations from API`);
  } catch (err) {
    console.warn(`⚠️ API unavailable (${err.message}), using fallback stations`);
    stations = fallbackData?.data?.stations || [];
    console.log(`📻 Using ${stations.length} fallback stations`);
  }

  const today = new Date().toISOString().split("T")[0];

  // Build URL entries
  const staticUrls = STATIC_PAGES.map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  const stationUrls = stations.map(
    (station) => `  <url>
    <loc>${SITE_URL}/${station.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join("\n")}
${stationUrls.join("\n")}
</urlset>
`;

  // Write sitemap to public folder
  const publicDir = path.join(__dirname, "..", "public");
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);

  console.log(
    `✅ Sitemap generated with ${STATIC_PAGES.length + stations.length} URLs`
  );
}

generateSitemap().catch((err) => {
  console.error("❌ Failed to generate sitemap:", err);
  process.exit(1);
});

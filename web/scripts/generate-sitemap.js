const fs = require("fs");
const path = require("path");

const SITE_URL = "https://www.radiocrestin.ro";
const API_URL = "https://api.radiocrestin.ro/api/v1/stations";

const STATIC_PAGES = [
  { path: "", priority: "1.0" },
  { path: "/intrebari-frecvente", priority: "0.8" },
  { path: "/descarca-aplicatia-radio-crestin", priority: "0.8" },
  { path: "/privacy-policy", priority: "0.5" },
  { path: "/terms-of-service", priority: "0.5" },
  { path: "/statistici", priority: "0.5" },
];

async function generateSitemap() {
  console.log("🔄 Generating sitemap...");

  // Fetch stations from API
  const response = await fetch(API_URL);
  const data = await response.json();
  const stations = data.data?.stations || [];

  console.log(`📻 Found ${stations.length} stations`);

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

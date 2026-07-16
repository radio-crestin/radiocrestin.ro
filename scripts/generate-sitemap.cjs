const fs = require("fs");
const path = require("path");

const fallbackData = require("../src/common/data/fallback-stations.json");

const SITE_URL = "https://www.radiocrestin.ro";
const API_URL = "https://api.radiocrestin.ro/api/v1/stations";

// The host serves directory-format URLs and 308-redirects "/x" to "/x/",
// so every sitemap URL must use the trailing-slash form (matching canonicals).
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/muzica-crestina/", priority: "0.8", changefreq: "weekly" },
  { path: "/predici/", priority: "0.8", changefreq: "weekly" },
  { path: "/radio-crestin-pentru-copii/", priority: "0.8", changefreq: "weekly" },
  { path: "/intrebari-frecvente/", priority: "0.8", changefreq: "monthly" },
  { path: "/descarca-aplicatia-radio-crestin/", priority: "0.8", changefreq: "monthly" },
  { path: "/church-hub/", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy-policy/", priority: "0.3", changefreq: "yearly" },
  { path: "/terms-of-service/", priority: "0.3", changefreq: "yearly" },
  { path: "/statistici/", priority: "0.5", changefreq: "daily" },
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
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  // Only station root pages: /{slug}/recent-songs and /{slug}/reviews are
  // modal deep-links that canonicalize to the station root, so listing them
  // in the sitemap would advertise non-canonical URLs.
  const stationUrls = stations.map(
    (station) => `  <url>
    <loc>${SITE_URL}/${station.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
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

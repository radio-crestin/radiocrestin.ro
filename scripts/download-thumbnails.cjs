const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const fallbackData = require("../src/common/data/fallback-stations.json");

const API_URL = "https://api.radiocrestin.ro/api/v1/stations";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "station-thumbnails");
const THUMB_SIZE = 256;
const QUALITY = 80;

async function downloadThumbnails() {
  console.log("Downloading and optimizing station thumbnails...");

  let stations = [];
  try {
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    stations = data.data?.stations || [];
    if (stations.length === 0) throw new Error("Empty stations");
    console.log(`Found ${stations.length} stations from API`);
  } catch (err) {
    console.warn(`API unavailable (${err.message}), using fallback stations`);
    stations = fallbackData?.data?.stations || [];
    console.log(`Using ${stations.length} fallback stations`);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const batchSize = 10;
  for (let i = 0; i < stations.length; i += batchSize) {
    const batch = stations.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (station) => {
        const slug = station.slug;
        const outputPath = path.join(OUTPUT_DIR, `${slug}.webp`);

        // Skip if exists and < 24h old
        if (fs.existsSync(outputPath)) {
          const stat = fs.statSync(outputPath);
          if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) {
            skipped++;
            return;
          }
        }

        const thumbUrl = station.thumbnail_url;
        if (!thumbUrl || thumbUrl === "null" || thumbUrl.trim() === "") {
          skipped++;
          return;
        }

        try {
          const response = await fetch(thumbUrl, {
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const buffer = Buffer.from(await response.arrayBuffer());

          await sharp(buffer)
            .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
            .webp({ quality: QUALITY })
            .toFile(outputPath);

          downloaded++;
        } catch (err) {
          console.warn(`  Failed: ${slug} (${err.message})`);
          failed++;
        }
      })
    );
  }

  console.log(
    `Thumbnails: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`
  );
}

downloadThumbnails().catch((err) => {
  console.error("Failed to download thumbnails:", err);
});

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const fallbackData = require("../src/common/data/fallback-stations.json");

const API_URL = "https://api.radiocrestin.ro/api/v1/stations";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "station-thumbnails");
const COLORS_PATH = path.join(
  __dirname,
  "..",
  "src",
  "common",
  "data",
  "station-colors.json"
);
const THUMB_SIZE = 256;
const QUALITY = 80;

// ---------------------------------------------------------------------------
// Color extraction tuning
// ---------------------------------------------------------------------------
const SAMPLE_SIZE = 32; // thumbnails are downscaled to ~32x32 for sampling
const HUE_BUCKETS = 24; // 15° per bucket
const ALPHA_MIN = 128; // ignore transparent pixels
const WHITE_MIN_CHANNEL = 235; // near-white pixels (logo backgrounds)
const BLACK_MAX_CHANNEL = 30; // near-black pixels (text/outlines)
const MIN_CHROMA = 0.12; // (max-min)/255 below this = gray, ignored
const MIN_VIVID_RATIO = 0.03; // <3% vivid pixels => b&w logo, omit station
const SECONDARY_MIN_HUE_DIST = 60; // secondary must sit ≥60° away in hue
const SECONDARY_MIN_WEIGHT = 0.2; // ...with ≥20% of the primary's weight
const DERIVED_HUE_SHIFT = 40; // fallback secondary: rotate hue + darken
const DERIVED_DARKEN = 0.12;
// Glow normalization: rich mid-tones for 20-45% opacity glows on both the
// #1E1E1E dark frame and the #FFFBEF light frame — never neon, never pastel.
const GLOW_LIGHTNESS = [0.38, 0.58];
const GLOW_SATURATION = [0.35, 0.85];

async function loadStations() {
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
  return stations;
}

async function downloadThumbnails(stations) {
  console.log("Downloading and optimizing station thumbnails...");

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

// ---------------------------------------------------------------------------
// Dominant-color extraction (station hero glow palettes)
// ---------------------------------------------------------------------------

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Clamp lightness/saturation so the color works as a soft glow at low opacity
// on both dark and light frames.
function normalizeGlow(hsl) {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, GLOW_SATURATION[0], GLOW_SATURATION[1]);
  const l = clamp(hsl.l, GLOW_LIGHTNESS[0], GLOW_LIGHTNESS[1]);
  return toHex(...hslToRgb(h, s, l));
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Merge bucket i with its two hue-adjacent neighbours (circular) so a
// color straddling a 15° boundary still reads as one cluster.
function mergeNeighbors(buckets, i) {
  const parts = [
    buckets[(i + HUE_BUCKETS - 1) % HUE_BUCKETS],
    buckets[i],
    buckets[(i + 1) % HUE_BUCKETS],
  ];
  const w = parts.reduce((sum, p) => sum + p.w, 0);
  if (w === 0) return { w: 0, r: 0, g: 0, b: 0 };
  return {
    w,
    r: parts.reduce((sum, p) => sum + p.r, 0) / w,
    g: parts.reduce((sum, p) => sum + p.g, 0) / w,
    b: parts.reduce((sum, p) => sum + p.b, 0) / w,
  };
}

// Heaviest merged cluster in a bucket array (first index wins ties).
function strongestCluster(buckets) {
  let best = { w: 0, r: 0, g: 0, b: 0 };
  let bestWeight = -1;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    const m = mergeNeighbors(buckets, i);
    if (m.w > bestWeight) {
      bestWeight = m.w;
      best = m;
    }
  }
  return best;
}

/**
 * Extract a { primary, secondary } glow palette from a local thumbnail.
 * Returns null when the logo has no meaningful color (b&w logos) —
 * the runtime util returns null for those (no color wash).
 */
async function extractPalette(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const bucketSpan = 360 / HUE_BUCKETS;
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({
    w: 0,
    r: 0,
    g: 0,
    b: 0,
  }));

  let opaque = 0;
  let vivid = 0;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels > 3 ? data[i + 3] : 255;
    if (a < ALPHA_MIN) continue;
    opaque++;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= WHITE_MIN_CHANNEL) continue; // white logo background
    if (max <= BLACK_MAX_CHANNEL) continue; // black text/outlines
    const chroma = (max - min) / 255;
    if (chroma < MIN_CHROMA) continue; // grays don't drive the palette
    vivid++;

    const { h } = rgbToHsl(r, g, b);
    const idx = Math.min(HUE_BUCKETS - 1, Math.floor(h / bucketSpan));
    const w = chroma; // weight by saturation: vivid pixels dominate
    const bucket = buckets[idx];
    bucket.w += w;
    bucket.r += r * w;
    bucket.g += g * w;
    bucket.b += b * w;
  }

  if (opaque === 0 || vivid / opaque < MIN_VIVID_RATIO) return null;

  const primary = strongestCluster(buckets);
  const primaryHsl = rgbToHsl(primary.r, primary.g, primary.b);

  // Secondary: strongest cluster far enough away in hue to give the two
  // glows a real contrast, and heavy enough to be a genuine logo color.
  // Buckets within the exclusion radius of the primary hue are masked out
  // so a wide primary ridge can't bleed into the secondary's average and
  // drag it back toward the primary.
  const maskedBuckets = buckets.map((bucket, i) => {
    const center = (i + 0.5) * bucketSpan;
    return hueDistance(center, primaryHsl.h) < SECONDARY_MIN_HUE_DIST
      ? { w: 0, r: 0, g: 0, b: 0 }
      : bucket;
  });
  const secondary = strongestCluster(maskedBuckets);

  let secondaryHsl;
  if (secondary.w > 0 && secondary.w >= SECONDARY_MIN_WEIGHT * primary.w) {
    secondaryHsl = rgbToHsl(secondary.r, secondary.g, secondary.b);
  } else {
    // Single-color logo: derive a companion tone so the glows never match.
    secondaryHsl = {
      h: (primaryHsl.h + DERIVED_HUE_SHIFT) % 360,
      s: primaryHsl.s,
      l: Math.max(0, primaryHsl.l - DERIVED_DARKEN),
    };
  }

  return {
    primary: normalizeGlow(primaryHsl),
    secondary: normalizeGlow(secondaryHsl),
  };
}

function readExistingColors() {
  try {
    const parsed = JSON.parse(fs.readFileSync(COLORS_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isValidPalette(entry) {
  return (
    entry &&
    typeof entry.primary === "string" &&
    typeof entry.secondary === "string"
  );
}

async function extractStationColors(stations) {
  console.log("Extracting station glow colors from local thumbnails...");

  const fileSlugs = fs.existsSync(OUTPUT_DIR)
    ? fs
        .readdirSync(OUTPUT_DIR)
        .filter((f) => f.endsWith(".webp"))
        .map((f) => f.slice(0, -".webp".length))
    : [];

  if (fileSlugs.length === 0) {
    console.warn(
      "No local thumbnails found — keeping existing station-colors.json"
    );
    return;
  }

  const previous = readExistingColors();
  const stationSlugs = (stations || [])
    .map((s) => s && s.slug)
    .filter(Boolean);
  const slugs = [...new Set([...stationSlugs, ...fileSlugs])].sort();

  const result = {};
  let extracted = 0;
  let omitted = 0;
  let missing = 0;
  let failed = 0;
  const rows = [];

  for (const slug of slugs) {
    const filePath = path.join(OUTPUT_DIR, `${slug}.webp`);
    if (!fs.existsSync(filePath)) {
      // Thumbnail not downloaded (yet) — keep any previously extracted
      // palette instead of dropping the station to the neutral fallback.
      if (isValidPalette(previous[slug])) {
        result[slug] = previous[slug];
        rows.push([slug, previous[slug].primary, previous[slug].secondary, "kept (no file)"]);
      } else {
        rows.push([slug, "-", "-", "no file → fallback"]);
      }
      missing++;
      continue;
    }

    try {
      const palette = await extractPalette(filePath);
      if (palette) {
        result[slug] = palette;
        extracted++;
        rows.push([slug, palette.primary, palette.secondary, ""]);
      } else {
        omitted++;
        rows.push([slug, "-", "-", "b&w logo → fallback"]);
      }
    } catch (err) {
      failed++;
      console.warn(`  Color extraction failed: ${slug} (${err.message})`);
      if (isValidPalette(previous[slug])) {
        result[slug] = previous[slug];
        rows.push([slug, previous[slug].primary, previous[slug].secondary, "kept (error)"]);
      } else {
        rows.push([slug, "-", "-", "error → fallback"]);
      }
    }
  }

  // `slugs` is sorted and each slug is visited once, so `result`'s key
  // order is already sorted.
  fs.writeFileSync(COLORS_PATH, JSON.stringify(result, null, 2) + "\n");

  const slugWidth = Math.max(...rows.map(([slug]) => slug.length));
  const swatch = (hex) => {
    if (!process.stdout.isTTY || hex === "-") return "";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return ` \x1b[48;2;${r};${g};${b}m  \x1b[0m`;
  };
  for (const [slug, primary, secondary, note] of rows) {
    console.log(
      `  ${slug.padEnd(slugWidth)}  ${primary}${swatch(primary)}  ${secondary}${swatch(secondary)}${note ? `  ${note}` : ""}`
    );
  }

  console.log(
    `Station colors: ${extracted} extracted, ${omitted} omitted (b&w), ` +
      `${missing} without thumbnail, ${failed} failed → ` +
      `${Object.keys(result).length} palettes in station-colors.json`
  );
}

async function main() {
  const stations = await loadStations();

  try {
    await downloadThumbnails(stations);
  } catch (err) {
    console.error("Failed to download thumbnails:", err);
  }

  // Colors are extracted from the local files, so this must run even when
  // downloads were skipped (24h cache) or the network/API is down.
  try {
    await extractStationColors(stations);
  } catch (err) {
    console.error("Failed to extract station colors:", err);
  }
}

main().catch((err) => {
  console.error("Failed to process station thumbnails:", err);
});

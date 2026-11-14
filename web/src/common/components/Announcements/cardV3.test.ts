// SPEC "Card v3" (the owner's A-line): the home card is a sibling of the station tiles, on their
// own tokens, with the category as a subtitle line in the hue. Layout is checked in the browser;
// these guard the rules it relies on.
import { compile } from "sass";
import path from "path";
import { describe, expect, it } from "vitest";
import { contrast, HUE_THEMES, inkShare, mix } from "@/utils/announcementColors";

const root = path.resolve(__dirname, "../../../..");
const flat = (file: string) => compile(path.resolve(root, file), { loadPaths: [root] }).css.replace(/\s+/g, " ");
const css = flat("public/styles/_announcements.scss");
const tile = flat("src/common/components/StationItem/styles.module.scss");

/** The declarations of the first rule for `selector` in `sheet`, optionally inside a media block. */
const rule = (sheet: string, selector: string, media = "") => {
  const scope = media ? sheet.slice(sheet.indexOf(media)) : sheet;
  const start = scope.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector} ${media}`);
  return scope.slice(start, scope.indexOf("}", start));
};

describe("the home card on the station tile's tokens", () => {
  it("shares the tile's surface, radius and padding", () => {
    expect(rule(tile, ".station_item")).toMatch(/padding: var\(--station-card-pad-y\) var\(--station-card-pad-x\);.*border-radius: var\(--station-card-radius\)/);
    expect(rule(css, ".ann-inHome .ann-carousel")).toContain("border-radius: var(--station-card-radius)");
    expect(rule(css, ".ann-inHome .ann-carousel .ann-slide")).toContain("padding: var(--station-card-pad-y) var(--station-card-pad-x)");
    expect(rule(css, ".ann-carousel")).toContain("background: var(--station-card-color)");
  });

  it("gives the icon tile the station logo's box and radius", () => {
    expect(rule(tile, ".station_item .image_container")).toMatch(/width: var\(--station-card-media\);.*height: var\(--station-card-media\)/);
    expect(rule(tile, ".station_item .image_container img")).toContain("border-radius: var(--station-card-media-radius)");
    expect(rule(css, ".ann-inHome .ann-carousel .ann-icon")).toMatch(
      /width: var\(--station-card-media\);.*height: var\(--station-card-media\);.*border-radius: var\(--station-card-media-radius\)/,
    );
    expect(rule(css, ".ann-inHome .ann-carousel .ann-slide")).toContain("column-gap: var(--station-card-gap)");
  });

  it("uses the station name's type for the title and the song line's for the description", () => {
    expect(rule(tile, ".station_item .station_details .station_name")).toMatch(/font-size: 1.2rem;.*font-weight: 500/);
    expect(rule(css, ".ann-inHome .ann-carousel .ann-title")).toMatch(/font-size: 1.2rem;.*font-weight: 500/);
    expect(rule(tile, ".station_item .station_details .song_name, .station_item .station_details .artist_name")).toMatch(
      /font-size: 0.8rem;.*color: var\(--subtext-metadata-color\);.*line-height: 1.4/,
    );
    expect(rule(css, ".ann-inHome .ann-carousel .ann-body")).toMatch(/font-size: 0.8rem;.*line-height: 1.4;.*color: var\(--subtext-metadata-color\)/);
  });
});

describe("the home card's layout", () => {
  it("shows the category as a subtitle line in the hue, with no pill", () => {
    expect(rule(css, ".ann-inHome .ann-carousel .ann-tag")).toMatch(/height: auto;.*padding: 0;.*background: none;.*font-size: 0.8rem/);
    expect(rule(css, ".ann-inHome .ann-carousel .ann-meta")).toMatch(/grid-row: 3;.*margin: 5px 0 0/);
    expect(css).not.toMatch(/ann-tagPill|ann-tagLine|ann-v3B/);
  });

  it("puts the pager in the listener count's spot and the buttons in the heart's", () => {
    expect(rule(css, ".ann-inHome .ann-carousel .ann-nav")).toMatch(/position: absolute;.*top: 11px;.*right: 13px/);
    expect(rule(css, ".ann-inHome .ann-carousel .ann-actions")).toMatch(/grid-column: 4;.*grid-row: 1\/-1;.*align-self: end;.*justify-self: end/);
  });

  it("on phones, keeps the title clear of the arrows and puts the buttons below", () => {
    const phone = "@media screen and (max-width: 768px)";
    expect(rule(css, ".ann-inHome .ann-carousel .ann-title", phone)).toContain("margin-right: 76px");
    expect(rule(css, ".ann-inHome .ann-carousel .ann-nav .ann-count", phone)).toContain("display: none");
    expect(rule(css, ".ann-inHome .ann-carousel .ann-actions", phone)).toMatch(/grid-column: 1\/-1;.*grid-row: 4/);
  });
});

describe("the category line reads at AA on the card", () => {
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
  };
  for (const hue of ["#0D8040", "#075E54", "#0F6E63", "#F5C518", "#000000", "#FFFFFF"]) {
    for (const theme of ["dark", "light"] as const) {
      it(`${hue}, ${theme}`, () => {
        const t = HUE_THEMES[theme];
        // the tag's ink (as written inline by colorVars), now on the bare card surface
        const ink = mix(rgb(hue), inkShare(hue, theme, "tag"), t.toward);
        for (const surface of t.surfaces) expect(contrast(ink, rgb(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

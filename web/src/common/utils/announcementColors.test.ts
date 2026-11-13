import { describe, expect, it } from "vitest";
import type { IAnnouncement } from "@/models/Announcement";
import {
  accentHue,
  colorVars,
  contrast,
  HUE_THEMES,
  inkShare,
  mix,
  textOn,
  type HueTheme,
} from "@/utils/announcementColors";

const announcement = (extra: Partial<IAnnouncement>) => ({ slug: "a", title: "T", ...extra }) as IAnnouncement;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
};

describe("textOn", () => {
  it("picks white on dark colours and black on light ones", () => {
    expect(textOn("#0F6E63")).toBe("#FFFFFF");
    expect(textOn("#FFE600")).toBe("#111111");
    expect(textOn("not-a-colour")).toBe("#FFFFFF");
  });
});

describe("accentHue", () => {
  const category = { slug: "c", name: "C", color: "#0F6E63" };
  const button = { label: "B", color: "#0D8040" } as never;

  it("is the button colour, else the category colour, else none", () => {
    expect(accentHue(announcement({ category, button }))).toBe("#0D8040");
    expect(accentHue(announcement({ category }))).toBe("#0F6E63");
    expect(accentHue(announcement({ category: { slug: "c", name: "C" }, button: { label: "B" } as never }))).toBeUndefined();
  });

  it("skips colours that are not plain hex", () => {
    expect(accentHue(announcement({ category, button: { label: "B", color: "red" } as never }))).toBe("#0F6E63");
  });
});

describe("colorVars", () => {
  it("writes nothing when no colour is set, so the site theme applies", () => {
    expect(colorVars(announcement({ category: { slug: "c", name: "C" }, button: { label: "B" } as never }))).toEqual({});
  });

  it("puts the button colour on the button and the hue on the icon tile and the tag", () => {
    const vars = colorVars(
      announcement({
        category: { slug: "c", name: "C", color: "#0F6E63" },
        button: { label: "B", color: "#0D8040", text_color: "#FFFFFF" } as never,
      }),
    );
    expect(vars).toEqual({
      "--c": "#0D8040",
      "--btn-fg": "#FFFFFF",
      "--icon-bg": "color-mix(in srgb, #0D8040 var(--hue-tile), transparent)",
      "--icon-border": "color-mix(in srgb, #0D8040 var(--hue-edge), transparent)",
      "--icon-fg": "color-mix(in srgb, #0D8040 var(--hue-glyph), var(--hue-toward))",
      "--tag-bg": "color-mix(in srgb, #0D8040 var(--hue-fill), transparent)",
      "--tag-fg": "color-mix(in srgb, #0D8040 var(--hue-tag), var(--hue-toward))",
    });
  });

  it("uses the category colour as the hue when the button has none", () => {
    const vars = colorVars(announcement({ category: { slug: "c", name: "C", color: "#0F6E63" } })) as Record<string, string>;
    expect(vars["--c"]).toBeUndefined();
    expect(vars["--icon-fg"]).toContain("#0F6E63");
  });

  it("ignores colours that are not plain hex", () => {
    expect(
      colorVars(
        announcement({
          category: { slug: "c", name: "C", color: "red; background:url(x)" },
          button: { label: "B", color: "#25D366)", text_color: "javascript:" } as never,
        }),
      ),
    ).toEqual({});
  });
});

describe("the hue's tile and tag read at AA (4.5:1) in both themes", () => {
  // Rendered exactly as the stylesheet does it: the fill is the hue over the card or sheet
  // surface, the ink is the hue blended toward white (dark) or black (light).
  const worst = (hue: string, theme: HueTheme, part: "glyph" | "tag") => {
    const t = HUE_THEMES[theme];
    const share = inkShare(hue, theme, part);
    const fillShare = part === "glyph" ? t.tile : t.fill;
    return Math.min(
      ...t.surfaces.map((s) => contrast(mix(rgb(hue), share, t.toward), mix(rgb(hue), fillShare, rgb(s)))),
    );
  };

  for (const hue of ["#0D8040", "#075E54", "#0F6E63", "#F5C518"]) {
    for (const theme of ["dark", "light"] as const) {
      it(`${hue}, ${theme}: at the spec's shares`, () => {
        for (const part of ["glyph", "tag"] as const) {
          expect(inkShare(hue, theme, part)).toBe(HUE_THEMES[theme][part]);
          expect(worst(hue, theme, part)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it("blends further toward white or black for hues that need it, and says so inline", () => {
    for (const hue of ["#000000", "#FFFFFF", "#7F7F7F"]) {
      for (const theme of ["dark", "light"] as const) {
        for (const part of ["glyph", "tag"] as const) expect(worst(hue, theme, part)).toBeGreaterThanOrEqual(4.5);
      }
    }
    // black on a dark card: the glyph and the tag text lean to white
    const vars = colorVars(announcement({ category: { slug: "c", name: "C", color: "#000000" } })) as Record<string, string>;
    expect(parseInt(vars["--hue-glyph-d"])).toBeLessThan(65);
    expect(parseInt(vars["--hue-tag-d"])).toBeLessThan(50);
    expect(vars["--hue-glyph-l"]).toBeUndefined();
  });
});

// An announcement's own colours, as CSS variables. Every colour is optional (SPEC "Default
// colors come from each client's theme"): unset ones fall back to the theme tokens in
// public/styles/_announcements.scss.
import type React from "react";
import type { IAnnouncement } from "@/models/Announcement";

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** WCAG relative luminance. */
const luminance = ([r, g, b]: Rgb) => {
  const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio of two opaque colours. */
export const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** CSS color-mix(in srgb, a p, b): a straight blend of the encoded channels. */
export const mix = (a: Rgb, p: number, b: Rgb): Rgb => a.map((v, i) => v * p + b[i] * (1 - p)) as Rgb;

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export const textOn = (hex: string): string => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return "#FFFFFF";
  const lum = luminance(toRgb(hex));
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#FFFFFF" : "#111111";
};

const HEX = /^#[0-9a-f]{3,8}$/i;
const hex = (value: string | undefined | null) => (value && HEX.test(value) ? value : undefined);

/** The colour the tile and tag take: the button's, else the category's (SPEC "Accent hue"). */
export const accentHue = (a: IAnnouncement): string | undefined =>
  hex(a.button?.color) || hex(a.category?.color);

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * The hue treatment per theme (SPEC "Accent hue on the icon tile and tag"): a soft fill of the
 * hue, and an ink (glyph, tag text) that is the hue blended toward white (dark) or black
 * (light). `surfaces` are the backgrounds the card sits on (the home card and the sheets).
 */
export const HUE_THEMES = {
  dark: { surfaces: ["#1e1e1e", "#1A1A1A"], tile: 0.16, fill: 0.18, glyph: 0.65, tag: 0.5, toward: WHITE },
  light: { surfaces: ["#ffffff", "#FFFBEF"], tile: 0.12, fill: 0.14, glyph: 0.55, tag: 0.45, toward: BLACK },
} as const;

export type HueTheme = keyof typeof HUE_THEMES;
const AA = 4.5;

/**
 * How much of the hue the ink may keep and still read at AA on its fill, on every surface:
 * the spec's share, lowered in 5% steps (toward white or black) only for hues that need it.
 */
export const inkShare = (hue: string, theme: HueTheme, part: "glyph" | "tag"): number => {
  const t = HUE_THEMES[theme];
  const rgb = toRgb(hue);
  const fillShare = part === "glyph" ? t.tile : t.fill;
  const reads = (share: number) =>
    t.surfaces.every((s) => {
      const fill = mix(rgb, fillShare, toRgb(s));
      return contrast(mix(rgb, share, t.toward), fill) >= AA;
    });
  let share: number = t[part];
  while (share > 0 && !reads(share)) share = Math.max(0, Math.round((share - 0.05) * 100) / 100);
  return share;
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The announcement's own colours as CSS variables. Only colours the admin set are written; the
 * rest come from the site theme, so the server and the hydrated render produce the same
 * inline style (and the pre-paint markup already has the final colours).
 * - The button colour goes to the button.
 * - The hue (button colour, else category colour) tints the icon tile and the tag; the
 *   per-theme shares are in the stylesheet, lowered here (--hue-*) only when a hue needs it.
 */
export const colorVars = (a: IAnnouncement): React.CSSProperties => {
  const button = hex(a.button?.color);
  const buttonText = hex(a.button?.text_color);
  const hue = accentHue(a);
  const vars: Record<string, string> = {};
  if (button) Object.assign(vars, { "--c": button, "--btn-fg": buttonText || textOn(button) });
  else if (buttonText) vars["--btn-fg"] = buttonText;
  if (hue) {
    Object.assign(vars, {
      "--icon-bg": `color-mix(in srgb, ${hue} var(--hue-tile), transparent)`,
      "--icon-border": `color-mix(in srgb, ${hue} var(--hue-edge), transparent)`,
      "--icon-fg": `color-mix(in srgb, ${hue} var(--hue-glyph), var(--hue-toward))`,
      "--tag-bg": `color-mix(in srgb, ${hue} var(--hue-fill), transparent)`,
      "--tag-fg": `color-mix(in srgb, ${hue} var(--hue-tag), var(--hue-toward))`,
    });
    for (const theme of ["dark", "light"] as const) {
      for (const part of ["glyph", "tag"] as const) {
        const share = inkShare(hue, theme, part);
        if (share !== HUE_THEMES[theme][part]) vars[`--hue-${part}-${theme === "dark" ? "d" : "l"}`] = pct(share);
      }
    }
  }
  return vars as React.CSSProperties;
};

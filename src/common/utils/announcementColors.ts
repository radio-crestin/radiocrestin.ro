// An announcement's own colours, as CSS variables. Every colour is optional (SPEC "Default
// colors come from each client's theme"): unset ones fall back to the theme tokens in
// public/styles/_announcements.scss.
import type React from "react";
import type { IAnnouncement } from "@/models/Announcement";

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export const textOn = (hex: string): string => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return "#FFFFFF";
  const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#FFFFFF" : "#111111";
};

const HEX = /^#[0-9a-f]{3,8}$/i;
const hex = (value: string | undefined) => (value && HEX.test(value) ? value : undefined);

/**
 * The announcement's own colours as CSS variables (SPEC "Color hierarchy by importance").
 * Only colours the admin set are written; the rest come from the site theme, so the server
 * and the hydrated render produce the same inline style.
 * - The button colour goes to the button only: the one solid accent on the card.
 * - The category colour becomes a faint tint of the tag (with a readable label) and of the
 *   icon tile; no other element borrows it.
 */
export const colorVars = (a: IAnnouncement): React.CSSProperties => {
  const button = hex(a.button?.color);
  const category = hex(a.category?.color);
  const buttonText = hex(a.button?.text_color);
  return {
    ...(button && { "--c": button, "--btn-fg": buttonText || textOn(button) }),
    ...(!button && buttonText && { "--btn-fg": buttonText }),
    ...(category && {
      "--tag-bg": `color-mix(in srgb, ${category} var(--tag-tint), transparent)`,
      "--tag-fg": `color-mix(in srgb, ${category} var(--tag-ink), var(--tag-ink-base))`,
      "--icon-bg": `color-mix(in srgb, ${category} 10%, var(--a-ctrl))`,
    }),
  } as React.CSSProperties;
};

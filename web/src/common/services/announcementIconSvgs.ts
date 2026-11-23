// SVG markup for announcement icons. Build-time only: the snapshot carries the markup of the
// icons it actually uses, so none of these strings ship in the client bundle.
import type { ActionType } from "@/models/Announcement";

const stroke = (paths: string, width = 2) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const filled = (paths: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${paths}</svg>`;

const play = filled('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>');
const external = stroke('<path d="M7 17 17 7M9 7h8v8"/>', 2.4);

export const ICON_SVGS: Record<string, string> = {
  whatsapp: filled(
    '<path d="M20.5 3.5A11.8 11.8 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.6 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.7 1.45c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.47-8.4ZM12.06 21.8c-1.78 0-3.52-.48-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.27c0-5.45 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.45 9.9-9.9 9.9Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35Z"/>',
  ),
  calendar: stroke(
    '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M12 13.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 15.3l2-.3z" fill="currentColor" stroke="none"/>',
  ),
  car: stroke(
    '<path d="M5 17h14v-4.5l-1.8-4.6A2 2 0 0 0 15.3 6.6H8.7a2 2 0 0 0-1.9 1.3L5 12.5z"/><path d="M5 17v2M19 17v2M3.5 11.5H5M19 11.5h1.5"/><circle cx="8.5" cy="14" r="1" fill="currentColor"/><circle cx="15.5" cy="14" r="1" fill="currentColor"/>',
  ),
  warning: stroke(
    '<path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5M12 17h.01"/>',
  ),
  heart: stroke('<path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z"/>'),
  play,
  megaphone: stroke('<path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6M7 14l1 5h2"/>'),
  bell: stroke('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  gift: stroke(
    '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V12M12 8v13"/><path d="M12 8S10.5 3.5 8 3.5a2.25 2.25 0 0 0 0 4.5M12 8s1.5-4.5 4-4.5a2.25 2.25 0 0 1 0 4.5"/>',
  ),
  bible: stroke(
    '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M12 6.5v7M9.5 9h5"/>',
  ),
  info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  star: stroke('<path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'),
};

const ACTION_SVGS: Partial<Record<ActionType, string>> = {
  external,
  android_intent: external,
  page: stroke('<path d="m9 6 6 6-6 6"/>', 2.4),
  in_app_browser: stroke('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17"/>', 2.2),
  station: play,
};

/** The button's icon: `auto` picks one from the action, `none` hides it, else an icon name. */
export const buttonIconSvg = (icon: string, action: ActionType): string | undefined => {
  if (icon === "none") return undefined;
  if (icon === "auto") return ACTION_SVGS[action];
  return ICON_SVGS[icon] ?? ACTION_SVGS[action];
};

// The share action (button.action.type "share"): the Web Share API where the browser has it,
// else the link copied to the clipboard with a short "copied" notice.
import { T } from "./strings";
import styles from "./styles";

const SITE_URL = "https://www.radiocrestin.ro/";
const NOTICE_MS = 2500;

/** The shared link, tagged like the player's station shares so PostHog sees where visits came from. */
const withUtm = (url: string, channel: string) => {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return url;
    u.searchParams.set("utm_source", channel);
    u.searchParams.set("utm_medium", "share");
    return u.href;
  } catch {
    return url;
  }
};

let notice: HTMLElement | null = null;
let noticeTimer = 0;

/** A short, polite status message at the bottom of the screen (no toast container on every page). */
const showNotice = (text: string) => {
  if (!notice) {
    notice = document.createElement("div");
    notice.className = styles.notice;
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = text;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice && (notice.hidden = true), NOTICE_MS);
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** Shares `url` (the website when absent) with `text` (ours when absent). */
export const shareLink = async (url: string | null, text: string | null) => {
  const link = url || SITE_URL;
  const message = text || T.shareText;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: message, url: withUtm(link, "native_share") });
      return;
    } catch (e) {
      // closed the share sheet: nothing to do; anything else (not allowed here): copy instead
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  const copied = await copy(withUtm(link, "copy_link"));
  showNotice(copied ? T.linkCopied : T.copyFailed(link));
};

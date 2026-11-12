// Build-time only (imported by BaseLayout): turns the pre-paint functions into the minified
// inline <head> script. Kept apart so esbuild never reaches the client bundle.
import { transformSync } from "esbuild";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import { annEligibility, annPrepaintBoot, toPrepaintData } from "@/utils/announcementsPrepaint";

const minified = transformSync(`(${annPrepaintBoot})(D,${annEligibility})`, {
  minify: true,
  target: "es2019",
}).code.trim().replace(/;$/, "");

/** The script code without its data; used to keep an eye on its size. */
export const PREPAINT_CODE = minified;

/**
 * JSON that is safe inside an inline <script>: no "</script>", "<!--" or "&" sequences,
 * and no U+2028/U+2029 (line terminators in older JavaScript engines).
 */
export const scriptSafeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/** The inline <head> script; empty when the snapshot has nothing to show. */
export const prepaintScript = (snapshot: IAnnouncementsSnapshot): string => {
  const data = toPrepaintData(snapshot);
  if (!data.i.length) return "";
  // A replacer function, so "$&"-style patterns in the data are never expanded.
  return minified.replace("(D,", () => `(${scriptSafeJson(data)},`);
};

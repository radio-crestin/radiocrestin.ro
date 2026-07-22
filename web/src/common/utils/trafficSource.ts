// Entry-channel attribution: collapse the messy referrer/utm landscape into a
// small set of stable labels ("google", "chatgpt", "whatsapp", …) so PostHog
// breakdowns don't have to wrangle raw domains. PostHog still auto-captures
// the raw $referrer / $referring_domain / utm_* values alongside.

export interface TrafficSource {
  /** Friendly channel label, or "referral" (unknown external), "direct", "internal" */
  source: string;
  /** Raw context: the utm_source / click-id name / referring domain */
  detail?: string;
}

// Order matters: AI assistants before search engines (gemini.google.com must
// not fall through to the google.* rule), specific hosts before broad ones.
const DOMAIN_RULES: Array<[string, RegExp]> = [
  // AI assistants
  ["chatgpt", /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/],
  ["perplexity", /(^|\.)perplexity\.ai$/],
  ["claude", /(^|\.)claude\.ai$/],
  ["gemini", /^gemini\.google\.com$/],
  ["copilot", /^copilot\.microsoft\.com$/],
  ["grok", /(^|\.)grok\.com$|(^|\.)x\.ai$/],
  ["deepseek", /(^|\.)deepseek\.com$/],
  ["meta-ai", /(^|\.)meta\.ai$/],
  // Search engines
  ["google", /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/],
  ["bing", /(^|\.)bing\.com$/],
  ["duckduckgo", /(^|\.)duckduckgo\.com$/],
  ["yahoo", /(^|\.)yahoo\.com$/],
  ["yandex", /(^|\.)yandex\.(com|ru)$/],
  ["ecosia", /(^|\.)ecosia\.org$/],
  ["brave", /^search\.brave\.com$/],
  // Social / messaging
  ["facebook", /(^|\.)facebook\.com$|^fb\.me$/],
  ["instagram", /(^|\.)instagram\.com$/],
  ["whatsapp", /(^|\.)whatsapp\.com$/],
  ["telegram", /(^|\.)t\.me$|(^|\.)telegram\.(me|org)$/],
  ["twitter", /(^|\.)twitter\.com$|(^|\.)x\.com$|^t\.co$/],
  ["youtube", /(^|\.)youtube\.com$|^youtu\.be$/],
  ["tiktok", /(^|\.)tiktok\.com$/],
  ["linkedin", /(^|\.)linkedin\.com$|^lnkd\.in$/],
  ["reddit", /(^|\.)reddit\.com$/],
  ["pinterest", /(^|\.)pinterest\.[a-z.]+$/],
];

// Short utm_source spellings that the domain rules can't recognize
const UTM_ALIASES: Record<string, string> = {
  fb: "facebook",
  ig: "instagram",
  x: "twitter",
  wa: "whatsapp",
  tg: "telegram",
  yt: "youtube",
};

const matchDomain = (host: string): string | null => {
  for (const [source, pattern] of DOMAIN_RULES) {
    if (pattern.test(host)) return source;
  }
  return null;
};

export const classifyTrafficSource = (
  referrer: string,
  params: URLSearchParams,
  ownHostname: string,
): TrafficSource => {
  // 1. Explicit utm_source wins (ChatGPT appends utm_source=chatgpt.com,
  //    our own share links append utm_source=whatsapp etc.)
  const utmSource = params.get("utm_source")?.trim().toLowerCase();
  if (utmSource) {
    const mapped = UTM_ALIASES[utmSource] ?? matchDomain(utmSource) ?? utmSource;
    return { source: mapped, detail: utmSource };
  }

  // 2. Platform click-ids identify the source even when utm tags are absent
  //    (and some platforms strip the referrer)
  if (params.get("gclid")) return { source: "google", detail: "gclid" };
  if (params.get("msclkid")) return { source: "bing", detail: "msclkid" };
  if (params.get("fbclid")) return { source: "facebook", detail: "fbclid" };
  if (params.get("ttclid")) return { source: "tiktok", detail: "ttclid" };
  if (params.get("twclid")) return { source: "twitter", detail: "twclid" };

  // 3. Fall back to the referrer domain
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (!host) return { source: "direct" };
  if (host === ownHostname.toLowerCase()) return { source: "internal" };

  const known = matchDomain(host);
  if (known) return { source: known, detail: host };
  return { source: "referral", detail: host };
};

/**
 * Tag an outbound share URL so the resulting inbound visit attributes back to
 * the channel it was shared through (otherwise WhatsApp/Telegram/native-sheet
 * arrivals all read as "direct" — apps send no referrer).
 */
export const withShareUtm = (url: string, channel: string): string =>
  `${url}${url.includes("?") ? "&" : "?"}utm_source=${encodeURIComponent(channel)}&utm_medium=share`;

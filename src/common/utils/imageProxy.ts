const PROXIED_DOMAINS = [
  "fsn1.your-objectstorage.com",
  "radio-crestin.s3.eu-central-1.amazonaws.com",
];

const PROXY_BASE = "https://cdn.radiocrestin.ro";

export function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (PROXIED_DOMAINS.includes(parsed.hostname)) {
      return `${PROXY_BASE}/?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Not a valid URL, return as-is
  }
  return url;
}

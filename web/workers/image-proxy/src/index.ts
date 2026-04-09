const ALLOWED_DOMAINS = [
  "fsn1.your-objectstorage.com",
  "radio-crestin.s3.eu-central-1.amazonaws.com",
];

const ONE_MONTH = 60 * 60 * 24 * 30;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract image URL from path: /https://domain/path → fetch that URL
    // Or from query param: /?url=https://...
    let imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      // Try path-based: /image-proxy/https://domain/path
      const pathMatch = url.pathname.match(/^\/(.+)$/);
      if (pathMatch) {
        imageUrl = decodeURIComponent(pathMatch[1]);
      }
    }

    if (!imageUrl) {
      return new Response("Missing image URL", { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
      return new Response("Domain not allowed", { status: 403 });
    }

    // Fetch with Cloudflare caching — this caches the subrequest at the edge
    const response = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
      cf: {
        cacheTtl: ONE_MONTH,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return new Response("Image not found", { status: response.status });
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    // Return with long cache headers — Cloudflare CDN caches this response
    // because it comes from a Worker on a zone route (not Pages Function)
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${ONE_MONTH}, s-maxage=${ONE_MONTH}, immutable`,
        "Access-Control-Allow-Origin": "*",
        "Vary": "Accept",
      },
    });
  },
};

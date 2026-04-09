const ALLOWED_DOMAINS = [
  "fsn1.your-objectstorage.com",
  "radio-crestin.s3.eu-central-1.amazonaws.com",
];

const ONE_MONTH = 60 * 60 * 24 * 30;

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing 'url' parameter", { status: 400 });
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

  // Check edge cache for this proxy URL
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from origin
  const originResponse = await fetch(imageUrl, {
    headers: { Accept: "image/*" },
  });

  if (!originResponse.ok) {
    return new Response("Failed to fetch image", {
      status: originResponse.status,
    });
  }

  const contentType =
    originResponse.headers.get("content-type") || "image/jpeg";

  const response = new Response(originResponse.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${ONE_MONTH}, s-maxage=${ONE_MONTH}, immutable`,
      "Access-Control-Allow-Origin": "*",
    },
  });

  // Store proxy response at Cloudflare edge (non-blocking)
  context.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
};

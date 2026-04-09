const ALLOWED_DOMAINS = [
  "fsn1.your-objectstorage.com",
  "radio-crestin.s3.eu-central-1.amazonaws.com",
];

const ONE_MONTH = 60 * 60 * 24 * 30;

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
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

  // Use Cloudflare's cf options to cache at the edge
  const originResponse = await fetch(imageUrl, {
    headers: { Accept: "image/*" },
    cf: {
      cacheTtl: ONE_MONTH,
      cacheEverything: true,
    },
  });

  if (!originResponse.ok) {
    return new Response("Failed to fetch image", {
      status: originResponse.status,
    });
  }

  const contentType =
    originResponse.headers.get("content-type") || "image/jpeg";

  return new Response(originResponse.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${ONE_MONTH}, immutable`,
      "Access-Control-Allow-Origin": "*",
      "CF-Cache-Status": originResponse.headers.get("cf-cache-status") || "MISS",
    },
  });
};

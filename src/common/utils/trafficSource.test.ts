import { describe, expect, it } from "vitest";
import { classifyTrafficSource, withShareUtm } from "./trafficSource";

const OWN_HOST = "www.radiocrestin.ro";

const classify = (referrer: string, search = "") =>
  classifyTrafficSource(referrer, new URLSearchParams(search), OWN_HOST);

describe("classifyTrafficSource", () => {
  it("classifies search engines from the referrer, incl. country TLDs", () => {
    expect(classify("https://www.google.com/").source).toBe("google");
    expect(classify("https://www.google.ro/search?q=radio").source).toBe("google");
    expect(classify("https://www.google.co.uk/").source).toBe("google");
    expect(classify("https://www.bing.com/search?q=x").source).toBe("bing");
    expect(classify("https://duckduckgo.com/").source).toBe("duckduckgo");
    expect(classify("https://search.brave.com/search?q=x").source).toBe("brave");
  });

  it("classifies AI assistants, ahead of broader domain rules", () => {
    expect(classify("https://chatgpt.com/").source).toBe("chatgpt");
    expect(classify("https://chat.openai.com/").source).toBe("chatgpt");
    expect(classify("https://www.perplexity.ai/").source).toBe("perplexity");
    expect(classify("https://claude.ai/").source).toBe("claude");
    // gemini.google.com must NOT fall through to "google"
    expect(classify("https://gemini.google.com/").source).toBe("gemini");
    expect(classify("https://copilot.microsoft.com/").source).toBe("copilot");
  });

  it("classifies social and messaging referrers", () => {
    expect(classify("https://l.facebook.com/l.php?u=x").source).toBe("facebook");
    expect(classify("https://t.co/abc").source).toBe("twitter");
    expect(classify("https://x.com/user/status/1").source).toBe("twitter");
    expect(classify("https://t.me/share").source).toBe("telegram");
    expect(classify("https://chat.whatsapp.com/xyz").source).toBe("whatsapp");
    expect(classify("https://m.youtube.com/watch?v=1").source).toBe("youtube");
  });

  it("prefers utm_source over the referrer and normalizes it", () => {
    const chatgpt = classify("https://www.google.com/", "utm_source=chatgpt.com");
    expect(chatgpt.source).toBe("chatgpt");
    expect(chatgpt.detail).toBe("chatgpt.com");
    expect(classify("", "utm_source=FB").source).toBe("facebook");
    // Our own share-link tags pass through as-is
    expect(classify("", "utm_source=whatsapp&utm_medium=share").source).toBe("whatsapp");
    expect(classify("", "utm_source=copy_link&utm_medium=share").source).toBe("copy_link");
    // Unknown utm_source values survive untouched
    expect(classify("", "utm_source=newsletter").source).toBe("newsletter");
  });

  it("recognizes platform click-ids when utm tags are absent", () => {
    expect(classify("", "gclid=abc123").source).toBe("google");
    expect(classify("", "msclkid=abc").source).toBe("bing");
    expect(classify("https://out.example.net/", "fbclid=xyz").source).toBe("facebook");
  });

  it("splits direct / internal / unknown referral", () => {
    expect(classify("")).toEqual({ source: "direct" });
    expect(classify("not a url")).toEqual({ source: "direct" });
    expect(classify(`https://${OWN_HOST}/radio-gosen/`).source).toBe("internal");
    const unknown = classify("https://www.crestintotal.ro/linkuri/");
    expect(unknown.source).toBe("referral");
    expect(unknown.detail).toBe("www.crestintotal.ro");
  });
});

describe("withShareUtm", () => {
  it("appends utm tags to a clean url", () => {
    expect(withShareUtm("https://www.radiocrestin.ro/aripi-spre-cer", "whatsapp")).toBe(
      "https://www.radiocrestin.ro/aripi-spre-cer?utm_source=whatsapp&utm_medium=share",
    );
  });

  it("chains with & when the url already has a query", () => {
    expect(withShareUtm("https://x.ro/a?b=1", "telegram")).toBe(
      "https://x.ro/a?b=1&utm_source=telegram&utm_medium=share",
    );
  });
});

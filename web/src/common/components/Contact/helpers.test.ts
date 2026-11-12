import { existsSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { readAppContext, withAppContext } from "./appContext";
import { CONTACT_PATHS } from "./copy";
import { fill } from "./copyText";
import { fitWithin, needsResize, outputTypeFor } from "./resizeImage";
import { buildSubmission, fromServerErrors } from "./submission";

describe("app context", () => {
  it("keeps only the known params, trimmed to their limits", () => {
    const context = readAppContext(`?source=app&platform=android&app_version=1.6.2&device_id=${"d".repeat(200)}&x=1`);
    expect(context).toEqual({ source: "app", platform: "android", app_version: "1.6.2", device_id: "d".repeat(128) });
  });

  it("carries the context into links", () => {
    expect(withAppContext("/contact/mesaj/", { source: "app", platform: "ios" })).toBe(
      "/contact/mesaj/?source=app&platform=ios",
    );
    expect(withAppContext("/contact/", {})).toBe("/contact/");
  });
});

describe("image resizing", () => {
  it("fits the longest side within 2000px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it("resizes big files or big pictures only", () => {
    expect(needsResize(500_000, 1200, 800)).toBe(false);
    expect(needsResize(5_000_000, 1200, 800)).toBe(true);
    expect(needsResize(500_000, 3000, 800)).toBe(true);
  });

  it("keeps transparency for PNG and WebP", () => {
    expect(outputTypeFor("image/jpeg")).toBe("image/jpeg");
    expect(outputTypeFor("image/png")).toBe("image/webp");
  });
});

describe("submission", () => {
  const extras = { context: { source: "app", device_id: "abc" }, honeypot: "", elapsedMs: 12345.6, turnstileToken: "" };

  it("sends only the visible fields, trimmed, with the app context", () => {
    const { fields, files } = buildSubmission(
      "station",
      { station_name: " Radio ", denomination: "baptist", denomination_other: "hidden", relation: "stale" },
      { logo: [] },
      extras,
    );
    expect(fields.kind).toBe("station");
    expect(fields.station_name).toBe("Radio");
    expect(fields.source).toBe("app");
    expect(fields.device_id).toBe("abc");
    expect(fields.elapsed_ms).toBe("12346");
    expect(fields).not.toHaveProperty("denomination_other");
    expect(fields).not.toHaveProperty("relation");
    expect(files).toEqual({ logo: [] });
  });

  it("defaults the source to web", () => {
    const { fields } = buildSubmission("general", {}, {}, { ...extras, context: {} });
    expect(fields.source).toBe("web");
  });

  it("adds the limits to server errors", () => {
    expect(fromServerErrors("announcement", { title: "too_long", images: "too_many_files", email: "invalid_email" })).toEqual({
      title: { code: "too_long", params: { max: 80 } },
      images: { code: "too_many_files", params: { max: 3 } },
      email: { code: "invalid_email", params: undefined },
    });
  });
});

describe("copy", () => {
  it("fills placeholders", () => {
    expect(fill("{count}/{max}", { count: 3, max: 80 })).toBe("3/80");
    expect(fill("{missing}")).toBe("{missing}");
  });

  it("has a page for every contact path", () => {
    for (const path of Object.values(CONTACT_PATHS)) {
      expect(existsSync(resolve(__dirname, "../../../pages", `.${path}index.astro`)), path).toBe(true);
    }
  });
});

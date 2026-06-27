import { describe, it, expect } from "vitest";
import {
  resolveKeyboardTarget,
  isEditableTarget,
  isSpaceKey,
} from "@/hooks/useSpaceBarPress";

// Reproduces PostHog issue 019e9a35: "Cannot read properties of null (reading
// 'addEventListener'/'removeEventListener')" — document.body was null in some
// webviews/timing, and the listener-target indexing crashed.

describe("resolveKeyboardTarget", () => {
  it("returns document.body when present", () => {
    const body = { tag: "body" } as any;
    const doc = { body, documentElement: {} } as any;
    expect(resolveKeyboardTarget(doc)).toBe(body);
  });

  it("falls back to documentElement when body is null (the crash case)", () => {
    const html = { tag: "html" } as any;
    const doc = { body: null, documentElement: html } as any;
    expect(resolveKeyboardTarget(doc)).toBe(html);
  });

  it("falls back to the document itself when body and documentElement are null", () => {
    const doc = { body: null, documentElement: null } as any;
    expect(resolveKeyboardTarget(doc)).toBe(doc);
  });

  it("returns null when there is no document (SSR) so the hook no-ops", () => {
    expect(resolveKeyboardTarget(null)).toBeNull();
    expect(resolveKeyboardTarget(undefined)).toBeNull();
  });
});

describe("isEditableTarget", () => {
  const el = (tagName: string, contentEditable?: string) =>
    ({
      tagName,
      getAttribute: (n: string) =>
        n === "contentEditable" ? contentEditable ?? null : null,
    }) as any;

  it("is true for input/textarea/select (any case)", () => {
    expect(isEditableTarget(el("INPUT"))).toBe(true);
    expect(isEditableTarget(el("TextArea"))).toBe(true);
    expect(isEditableTarget(el("select"))).toBe(true);
  });

  it("is true for contentEditable elements", () => {
    expect(isEditableTarget(el("DIV", "true"))).toBe(true);
  });

  it("is false for ordinary elements", () => {
    expect(isEditableTarget(el("BUTTON"))).toBe(false);
    expect(isEditableTarget(el("DIV"))).toBe(false);
  });

  it("does not throw for null or non-element targets (document, window)", () => {
    // The old code did `e.target.tagName.toLowerCase()` which threw a TypeError
    // when target had no tagName (window/document) — guard against that.
    expect(() => isEditableTarget(null)).not.toThrow();
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({} as any)).toBe(false);
  });
});

describe("isSpaceKey", () => {
  it("matches modern e.key", () => {
    expect(isSpaceKey({ key: " " } as any)).toBe(true);
  });
  it("matches e.code", () => {
    expect(isSpaceKey({ code: "Space" } as any)).toBe(true);
  });
  it("matches legacy keyCode", () => {
    expect(isSpaceKey({ keyCode: 32 } as any)).toBe(true);
  });
  it("is false for other keys", () => {
    expect(isSpaceKey({ key: "a", code: "KeyA", keyCode: 65 } as any)).toBe(false);
  });
});

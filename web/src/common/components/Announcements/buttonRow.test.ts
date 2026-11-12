// The card's button row never overflows: a long main label wraps inside its button, and only
// then does the row wrap, with "Ascunde" staying last and right-aligned. Layout itself is
// checked in the browser; these guard the markup and the rules it relies on.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { compile } from "sass";
import path from "path";
import { describe, expect, it } from "vitest";
import type { IAnnouncement } from "@/models/Announcement";
import Slide from "./Slide";

const LONG_LABEL = "Înscrie-te acum la cursul biblic gratuit de seară, în fiecare marți";

const announcement = {
  slug: "lung",
  title: "Curs biblic",
  body_html: "",
  dismissible: true,
  button: { label: LONG_LABEL, style: "filled", action: { type: "external", url: "https://example.com/" } },
} as unknown as IAnnouncement;

const noop = () => {};
const css = compile(path.resolve(__dirname, "../../../../public/styles/_announcements.scss")).css.replace(/\s+/g, " ");

/** The declarations of the first rule whose selector is exactly `selector`, optionally inside `at`. */
const rule = (selector: string, at = "") => {
  const scope = at ? css.slice(css.indexOf(at)) : css;
  const start = scope.indexOf(`${selector} {`);
  expect(start, `${selector} ${at}`).toBeGreaterThanOrEqual(0);
  return scope.slice(start, scope.indexOf("}", start));
};

describe("the card's button row with a long label", () => {
  const html = renderToString(createElement(Slide, { announcement, onPrimary: noop, onDismiss: noop }));

  it("keeps the whole label, in a wrappable span, before Ascunde", () => {
    expect(html).toContain(`<span class="ann-ctaLabel">${LONG_LABEL}</span>`);
    expect(html.indexOf("ann-ctaLabel")).toBeLessThan(html.indexOf("ann-dismiss"));
  });

  it("lets the main button shrink and its label wrap", () => {
    expect(rule(".ann-cta")).not.toContain("nowrap");
    expect(rule(".ann-cta")).toContain("min-height: 40px");
    expect(rule(".ann-actions .ann-cta")).toMatch(/flex: 1 1 0;.*max-width: max-content;.*min-width: min\(100%, 11rem\)/);
    expect(rule(".ann-ctaLabel")).toContain("min-width: 0");
  });

  it("wraps the row on phones, Ascunde staying right-aligned", () => {
    expect(rule(".ann-carousel .ann-actions", "@media (max-width: 640px)")).toContain("flex-wrap: wrap");
    expect(rule(".ann-dismiss")).toContain("margin-left: auto");
  });
});

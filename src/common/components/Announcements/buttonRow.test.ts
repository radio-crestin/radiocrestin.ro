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

/** The declarations of the first rule for `selector`, optionally inside an `at` block (e.g. a media query). */
const rule = (selector: string, at = "") => {
  const scopes = at
    ? [...css.matchAll(new RegExp(`${at.replace(/[()]/g, "\\$&")} \\{(.*?)\\} \\}`, "g"))].map((m) => m[1] + "}")
    : [css];
  for (const scope of scopes) {
    const start = scope.indexOf(`${selector} {`);
    if (start >= 0) return scope.slice(start, scope.indexOf("}", start));
  }
  throw new Error(`no rule ${selector} ${at}`);
};

describe("the button label's colour", () => {
  // The site's reset (reset.scss) sets color:black on every span; the label is a span.
  const all = compile(path.resolve(__dirname, "../../../../public/styles/_all.scss"), {
    loadPaths: [path.resolve(__dirname, "../../../../public/styles")],
  }).css.replace(/\s+/g, " ");

  it("follows the button's text colour, not the reset's black", () => {
    const inherit = all.indexOf(":where(.ann-ann, .ann-sheet, .ann-pop) span { color: inherit; }");
    const reset = all.search(/[ ,]span, applet[^{]*\{[^}]*color: black/);
    expect(inherit).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(-1);
    // same specificity (one type selector; :where adds none), so the later rule wins
    expect(inherit).toBeGreaterThan(reset);
    expect(rule(".ann-cta")).toContain("color: var(--btn-fg)");
    expect(css).not.toMatch(/\.ann-ctaLabel \{[^}]*color:/);
  });
});

describe("the card's button row with a long label", () => {
  const html = renderToString(createElement(Slide, { announcement, onPrimary: noop, onDismiss: noop }));

  it("keeps the whole label, in a wrappable span, before Ascunde", () => {
    expect(html).toContain(`<span class="ann-ctaLabel">${LONG_LABEL}</span>`);
    expect(html.indexOf("ann-ctaLabel")).toBeLessThan(html.indexOf("ann-dismiss"));
  });

  it("lets the main button shrink and its label wrap on phones", () => {
    expect(rule(".ann-cta")).not.toContain("nowrap");
    expect(rule(".ann-cta")).toContain("min-height: 40px");
    expect(rule(".ann-actions .ann-cta", "@media (max-width: 640px)")).toMatch(
      /flex: 1 1 0;.*max-width: max-content;.*min-width: min\(100%, 11rem\)/,
    );
    expect(rule(".ann-ctaLabel")).toContain("min-width: 0");
  });

  it("keeps a short label's button at its own width on desktop", () => {
    // Outside the phone layout nothing stretches the button: an 11rem minimum there made
    // "Intră în grup" overlap the "next" arrow in the auto-sized side column.
    const outsidePhones = css.replace(/@media \(max-width: 640px\) \{.*?\} \}/g, "");
    expect(outsidePhones).not.toMatch(/\.ann-actions \.ann-cta \{/);
    const html = renderToString(
      createElement(Slide, {
        announcement: { ...announcement, button: { ...announcement.button!, label: "Intră în grup" } },
        onPrimary: noop,
        onDismiss: noop,
      }),
    );
    expect(html).toContain('<span class="ann-ctaLabel">Intră în grup</span>');
  });

  it("wraps the row on phones, Ascunde staying right-aligned", () => {
    expect(rule(".ann-carousel .ann-actions", "@media (max-width: 640px)")).toContain("flex-wrap: wrap");
    expect(rule(".ann-dismiss")).toContain("margin-left: auto");
  });
});

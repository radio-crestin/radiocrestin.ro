// The card's layout (SPEC "Layout v2", UPDATE 3) and its button row: buttons fit their content
// and never stretch; a row too narrow wraps, and a label too long for a line of its own wraps
// inside its button (two lines at most). Layout itself is checked in the browser; these guard
// the markup and the rules it relies on.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { compile } from "sass";
import path from "path";
import { describe, expect, it } from "vitest";
import type { IAnnouncement } from "@/models/Announcement";
import Slide, { iconSizeVar } from "./Slide";

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

  it("keeps every label on one line, the buttons at their content width and the same height", () => {
    expect(rule(".ann-cta")).not.toContain("nowrap");
    expect(rule(".ann-ctaLabel")).toMatch(/overflow: hidden;.*white-space: nowrap;.*text-overflow: ellipsis/);
    expect(rule(".ann-actions .ann-cta")).toMatch(/flex: 0 1 auto;.*min-width: 0;.*max-width: 100%;.*height: 40px/);
    expect(rule(".ann-dismiss")).toContain("height: 40px");
    expect(css).not.toContain(".ann-actions .ann-ctaLabel");
    expect(css).not.toMatch(/min-width: min\(100%, 11rem\)/);
  });

  it("wraps the row, right-aligned, when the buttons don't fit side by side", () => {
    expect(rule(".ann-actions")).toContain("flex-wrap: wrap");
    expect(css).toMatch(/\.ann-actions \{ justify-content: flex-end; \}/);
  });

  it("gives the main button its full label as a title, for a label cut short", () => {
    const html = renderToString(createElement(Slide, { announcement, onPrimary: noop, onDismiss: noop }));
    expect(html).toContain(`title="${LONG_LABEL}"`);
  });

  it("renders a short label as is, with Ascunde right after it", () => {
    const html = renderToString(
      createElement(Slide, {
        announcement: { ...announcement, button: { ...announcement.button!, label: "Intră în grup" } },
        onPrimary: noop,
        onDismiss: noop,
      }),
    );
    expect(html).toContain('<span class="ann-ctaLabel">Intră în grup</span>');
    expect(rule(".ann-dismiss")).not.toContain("margin-left: auto");
  });
});

describe("the home card's layout", () => {
  it("makes the icon a square exactly as tall as the tag and title, 72px at most", () => {
    const icon = rule(".ann-carousel .ann-icon");
    expect(icon).toMatch(/grid-row: 1\/span 2;.*align-self: stretch;.*aspect-ratio: 1;/);
    expect(icon).toMatch(/min-height: var\(--ann-icon, 52px\);.*max-height: 72px/);
    // the glyph is out of the flow, so it never sizes the tile
    expect(rule(".ann-carousel .ann-icon svg")).toMatch(/position: absolute;.*width: 55%;.*min-width: 18px/);
    expect(rule(".ann-carousel .ann-title")).toMatch(/grid-row: 2;.*align-self: end/);
  });

  it("lines up the label's text, not its pill, with the title and the icon top", () => {
    // the pill moves left by its padding and up by the space above the text's cap height
    expect(css).toMatch(/\.ann-carousel \{ --ann-pager: 36px; --tag-pad: 9px; --tag-lift: 6px; \}/);
    expect(rule(".ann-tag")).toMatch(/padding: 0 9px;.*font-size: 11.5px/);
    expect(rule(".ann-tag")).toContain("line-height: 21px");
    expect(rule(".ann-carousel .ann-meta")).toMatch(
      /grid-row: 1;.*min-height: 0;.*margin: calc\(-1 \* var\(--tag-lift\)\) 0 0 calc\(-1 \* var\(--tag-pad\)\)/,
    );
  });

  it("keeps the pager on the label line without making it taller", () => {
    expect(rule(".ann-carousel .ann-nav")).toContain(
      "margin: calc((21px - var(--ann-pager)) / 2 - var(--tag-lift)) 0 calc((21px - var(--ann-pager)) / 2) 12px",
    );
  });

  it("starts the description at the card's left edge, under the icon", () => {
    expect(rule(".ann-carousel .ann-body")).toContain("grid-column: 1/3");
    expect(rule(".ann-carousel .ann-body", "@media (max-width: 640px)")).toContain("grid-column: 1/-1");
  });

  it("puts the buttons under the pager on desktop, and last, right-aligned, on phones", () => {
    expect(rule(".ann-carousel .ann-actions")).toMatch(/grid-column: 3;.*justify-self: end;.*justify-content: flex-end/);
    expect(rule(".ann-carousel .ann-actions", "@media (max-width: 640px)")).toMatch(
      /grid-column: 1\/-1;.*grid-row: 4;.*justify-content: flex-end/,
    );
  });

  it("sets the tile's minimum from icon.size (medium is the stylesheet's default)", () => {
    const style = (size?: string) => iconSizeVar({ ...announcement, icon: size ? { name: "x", size } : { name: "x" } } as IAnnouncement);
    expect(style("small")).toEqual({ "--ann-icon": "40px" });
    expect(style("large")).toEqual({ "--ann-icon": "72px" });
    expect(style("medium")).toEqual({});
    expect(style()).toEqual({});
    expect(style("huge")).toEqual({});
  });

  it("renders the hue and the icon size in the server markup, so the first paint is final", () => {
    const html = renderToString(
      createElement(Slide, {
        announcement: {
          ...announcement,
          icon: { name: "whatsapp", size: "small" },
          button: { ...announcement.button!, color: "#0D8040", text_color: "#FFFFFF" },
        } as IAnnouncement,
        onPrimary: noop,
        onDismiss: noop,
      }),
    );
    const style = html.match(/<section[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(style).toContain("--icon-bg:color-mix(in srgb, #0D8040 var(--hue-tile), transparent)");
    expect(style).toContain("--tag-fg:color-mix(in srgb, #0D8040 var(--hue-tag), var(--hue-toward))");
    expect(style).toContain("--ann-icon:40px");
  });
});

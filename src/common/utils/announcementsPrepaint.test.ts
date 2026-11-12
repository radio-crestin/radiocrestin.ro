import { afterEach, describe, expect, it, vi } from "vitest";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import { PREPAINT_CODE, prepaintScript } from "@/utils/announcementsPrepaintScript";
import {
  annEligibility,
  annPrepaintBoot,
  toPrepaintData,
  type PrepaintData,
  type PrepaintItem,
} from "@/utils/announcementsPrepaint";

const NOW = Date.parse("2026-11-12T10:00:00Z");
const BUILT = NOW - 60_000;

const data = (items: PrepaintItem[], r = 0, x = 99): PrepaintData => ({ b: BUILT, r, x, i: items });
const run = (
  items: PrepaintItem[],
  local = {},
  { feed = null as { t: number; s: string[] } | null, lang = "ro-ro", r = 0, rnd = 0, x = 99 } = {},
) => annEligibility(data(items, r, x), local, feed, lang, NOW, rnd);

describe("annEligibility", () => {
  it("shows everything with no local history", () => {
    expect(run([{ s: "a" }, { s: "b" }]).m).toEqual({ v: ["a", "b"], h: ["a", "b"], k: 0 });
  });

  it("hides dismissed and over-max-impressions slugs, and ignores a stale snooze", () => {
    const local = {
      dismissed: { a: "x" },
      // left behind by the removed "Mai târziu" button: no longer hides anything
      snoozed: { b: "2026-11-13T00:00:00Z" },
      impressions: { d: 3, e: 2 },
    };
    const r = run([{ s: "a" }, { s: "b" }, { s: "d", m: 3 }, { s: "e", m: 3 }], local);
    expect(r.d.h).toEqual(["b", "e"]);
  });

  it("respects the time window", () => {
    const r = run([{ s: "future", a: NOW + 1 }, { s: "ended", e: NOW }, { s: "live", a: NOW - 1, e: NOW + 1 }]);
    expect(r.d.h).toEqual(["live"]);
  });

  it("hides what a newer feed no longer lists, but ignores an older feed", () => {
    const items = [{ s: "a" }, { s: "b" }];
    expect(run(items, {}, { feed: { t: BUILT + 1, s: ["a"] } }).d.h).toEqual(["a"]);
    expect(run(items, {}, { feed: { t: BUILT - 1, s: ["a"] } }).d.h).toEqual(["a", "b"]);
  });

  it("splits web_mobile and web_desktop by viewport, and hides app-only items", () => {
    const r = run([
      { s: "phone", f: { p: "m" } },
      { s: "desk", f: { p: "d" } },
      { s: "app", f: { p: "" } },
      { s: "all", f: {} },
    ]);
    expect(r.m.h).toEqual(["phone", "all"]);
    expect(r.d.h).toEqual(["desk", "all"]);
  });

  it("matches locales by language or exact tag", () => {
    const items = [{ s: "ro", f: { lo: ["ro"] } }, { s: "ro_RO", f: { lo: ["ro-ro"] } }, { s: "en", f: { lo: ["en"] } }];
    expect(run(items, {}, { lang: "ro-ro" }).d.h).toEqual(["ro", "ro_RO"]);
    expect(run(items, {}, { lang: "ro" }).d.h).toEqual(["ro"]);
  });

  it("needs a known country for country filters", () => {
    const items = [{ s: "in", f: { ci: ["RO"] } }, { s: "out", f: { ce: ["RO"] } }, { s: "any" }];
    expect(run(items, {}).d.h).toEqual(["any"]);
    expect(run(items, { country: null }).d.h).toEqual(["any"]);
    expect(run(items, { country: "RO" }).d.h).toEqual(["in", "any"]);
    expect(run(items, { country: "MD" }).d.h).toEqual(["out", "any"]);
  });

  it("keeps station announcements out of the home list", () => {
    const r = run([{ s: "home" }, { s: "st", st: ["radio-elim"] }]);
    expect(r.d).toEqual({ v: ["home", "st"], h: ["home"], k: 0 });
  });

  it("caps home announcements at max_per_load after the other rules, but not station ones", () => {
    const items = [{ s: "gone" }, { s: "a" }, { s: "st", st: ["x"] }, { s: "b" }, { s: "c" }];
    const r = run(items, { dismissed: { gone: "x" } }, { x: 2 });
    expect(r.d.h).toEqual(["a", "b"]);
    expect(r.d.v).toEqual(["a", "st", "b"]);
  });

  it("picks the start slide from the rotation mode", () => {
    const items = [{ s: "a" }, { s: "b" }, { s: "c" }];
    expect(run(items, { rotationCursor: 4 }, { r: 1 }).d.k).toBe(1);
    expect(run(items, {}, { r: 2, rnd: 0.7 }).d.k).toBe(2);
    expect(run(items, { rotationCursor: 4 }, { r: 0 }).d.k).toBe(0);
    expect(run([], {}, { r: 1 }).d.k).toBe(0);
  });
});

describe("annPrepaintBoot", () => {
  afterEach(() => vi.unstubAllGlobals());

  const boot = (items: PrepaintItem[], stored: Record<string, unknown>) => {
    const appended: { id?: string; textContent?: string }[] = [];
    const win: Record<string, unknown> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k in stored ? JSON.stringify(stored[k]) : null) });
    vi.stubGlobal("navigator", { language: "ro-RO" });
    vi.stubGlobal("document", { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } });
    vi.stubGlobal("window", win);
    annPrepaintBoot(data(items), annEligibility);
    return { css: appended[0]?.textContent ?? "", result: win.__ann };
  };

  it("hides ineligible items and bells, and shows the start slide, per viewport", () => {
    const { css } = boot(
      [{ s: "a" }, { s: "b", f: { p: "d" } }, { s: "st", st: ["radio-elim"], m: 1 }],
      { "announcements-store": { state: { impressions: { st: 1 } } } },
    );
    expect(css).toContain(
      '@media(max-width:767.9px){[data-ann="b"],[data-ann="st"],[data-ann-b="radio-elim"],[data-ann-m],[data-ann-a]{display:none!important}' +
        '[data-ann-pp] [data-ann="a"]{display:grid!important;--pf:.4;--nf:.4}[data-ann-pp] [data-ann-c]:before{content:"1 din 1"}}',
    );
    expect(css).toContain('@media(min-width:768px){[data-ann="st"],[data-ann-b="radio-elim"],[data-ann-a]{display:none!important}');
    expect(css).toContain('[data-ann-pp] [data-ann-c]:before{content:"1 din 2"}}');
  });

  it("fades previous on the first slide and next on the last", () => {
    const css = (cursor: number) => {
      const appended: { textContent?: string }[] = [];
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => (k === "announcements-store" ? JSON.stringify({ state: { rotationCursor: cursor } }) : null),
      });
      vi.stubGlobal("navigator", { language: "ro-RO" });
      vi.stubGlobal("document", { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } });
      vi.stubGlobal("window", {});
      annPrepaintBoot(data([{ s: "a" }, { s: "b" }, { s: "c" }], 1), annEligibility);
      return appended[0].textContent ?? "";
    };
    expect(css(0)).toContain('[data-ann="a"]{display:grid!important;--pf:.4}');
    expect(css(2)).toContain('[data-ann="c"]{display:grid!important;--nf:.4}');
  });

  it("starts on the rotation's slide", () => {
    const appended: { textContent?: string }[] = [];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "announcements-store" ? JSON.stringify({ state: { rotationCursor: 4 } }) : null),
    });
    vi.stubGlobal("navigator", { language: "ro-RO" });
    vi.stubGlobal("document", { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } });
    vi.stubGlobal("window", {});
    annPrepaintBoot(data([{ s: "a" }, { s: "b" }, { s: "c" }], 1), annEligibility);
    // the middle of three: neither button faded
    expect(appended[0].textContent).toContain('[data-ann="b"]{display:grid!important}');
    expect(appended[0].textContent).toContain('content:"2 din 3"');
  });

  it("hides the whole card when nothing is left", () => {
    const { css, result } = boot([{ s: "a" }], { "announcements-store": { state: { dismissed: { a: "x" } } } });
    expect(css).toContain("[data-ann-r],[data-ann-m]{display:none!important}}");
    expect(result).toMatchObject({ d: { h: [] } });
  });

  it("hides nothing when storage holds corrupt JSON", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{oops" });
    const appended: object[] = [];
    vi.stubGlobal("document", { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } });
    vi.stubGlobal("navigator", { language: "ro" });
    vi.stubGlobal("window", {});
    annPrepaintBoot(data([{ s: "a" }]), annEligibility);
    expect(appended).toHaveLength(0);
  });

  it("survives broken storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    vi.stubGlobal("document", { createElement: () => ({}), head: { append: () => {} } });
    vi.stubGlobal("navigator", { language: "ro" });
    vi.stubGlobal("window", {});
    expect(() => annPrepaintBoot(data([{ s: "a" }]), annEligibility)).not.toThrow();
  });
});

describe("prepaintScript", () => {
  const snapshot = (announcements: unknown[]): IAnnouncementsSnapshot =>
    ({
      built_at: BUILT,
      settings: { rotation_mode: "rotate", max_per_load: 5 },
      announcements,
    }) as IAnnouncementsSnapshot;

  it("is empty without announcements", () => {
    expect(prepaintScript(snapshot([]))).toBe("");
  });

  it("compacts the snapshot to what the script reads", () => {
    const d = toPrepaintData(
      snapshot([
        { slug: "a", title: "T", body_html: "<b>x</b>", starts_at: "2026-11-12T00:00:00Z", filters: { platforms: [], locales: [] } },
        { slug: "c", filters: { locales: ["ro_RO"], platforms: ["web_mobile", "android"] } },
        { slug: "app", filters: { platforms: ["ios"] } },
        { slug: "b", placement: "station", station_slugs: ["x"], max_impressions: 2, filters: { countries_include: ["RO"] } },
      ]),
    );
    expect(d).toEqual({
      b: BUILT,
      r: 1,
      x: 5,
      i: [
        { s: "a", a: Date.parse("2026-11-12T00:00:00Z") },
        { s: "c", f: { p: "m", ci: undefined, ce: undefined, lo: ["ro-ro"] } },
        { s: "app", f: { p: "", ci: undefined, ce: undefined, lo: undefined } },
        { s: "b", st: ["x"], m: 2, f: { p: undefined, ci: ["RO"], ce: undefined, lo: undefined } },
      ],
    });
  });

  it("produces a standalone script that runs and stays small", () => {
    const code = prepaintScript(snapshot([{ slug: "a" }]));
    const appended: { textContent?: string }[] = [];
    const win: Record<string, unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function("localStorage", "navigator", "document", "window", code)(
      { getItem: () => null },
      { language: "ro-RO" },
      { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } },
      win,
    );
    expect(appended[0].textContent).toContain('[data-ann="a"]{display:grid!important;--pf:.4;--nf:.4}');
    expect(PREPAINT_CODE.length).toBeLessThan(1536);
  });
});

describe("prepaintScript safety", () => {
  const snapshot = (announcements: unknown[]): IAnnouncementsSnapshot =>
    ({
      built_at: BUILT,
      settings: { rotation_mode: "fixed", autoplay_seconds: 8, max_per_load: 5 },
      announcements,
    }) as IAnnouncementsSnapshot;

  const evil = [
    "</script><script>alert(1)</script>",
    "$&",
    "$'x",
    '"]{}*{display:none}',
    "a\u2028b",
  ];

  const runScript = (code: string) => {
    const appended: { textContent?: string }[] = [];
    // eslint-disable-next-line no-new-func
    new Function("localStorage", "navigator", "document", "window", code)(
      { getItem: () => null },
      { language: "ro-RO" },
      { createElement: () => ({}), head: { append: (el: object) => appended.push(el) } },
      {},
    );
    return appended[0]?.textContent ?? "";
  };

  it("keeps hostile slugs, titles and filters inside the script and out of the CSS", () => {
    const items = [
      { slug: "ok", title: evil[0], filters: { locales: evil, countries_exclude: evil } },
      ...evil.map((slug) => ({ slug, title: slug, placement: "station", station_slugs: evil })),
      { slug: "st", placement: "station", station_slugs: ["radio-elim", ...evil], max_impressions: 0 },
    ];
    const code = prepaintScript(snapshot(items));
    const html = `<head><script>${code}</script></head>`;

    expect(html.match(/<\/script/gi)).toHaveLength(1);
    expect(html.match(/<script/gi)).toHaveLength(1);
    expect(code).not.toMatch(/[\u2028\u2029]/);
    expect(code).not.toMatch(/<\/?script/i);
    expect(code).not.toContain("$&");

    const css = runScript(code);
    expect(css).not.toContain("*{display:none}");
    expect(css).not.toContain("script");
    // only plain slugs reach the selectors
    for (const selector of css.match(/\[data-ann[^\]]*\]/g) ?? []) {
      expect(selector).toMatch(/^\[data-ann(-[a-z]+)?(="[\w-]+")?\]$/);
    }
    expect(css).toContain('[data-ann="st"]');
    expect(css).toContain('[data-ann-b="radio-elim"]');
  });

  it("does not expand $-patterns from the data", () => {
    const code = prepaintScript(snapshot([{ slug: "a", filters: { locales: ["$&", "$`", "$'"] } }]));
    expect(code).toContain('"lo":["$\\u0026","$`","$\'"]');
    expect(code.startsWith("(function")).toBe(true);
    expect(() => runScript(code)).not.toThrow();
  });

  it("leaves nothing to inline when no slug is plain", () => {
    expect(prepaintScript(snapshot(evil.map((slug) => ({ slug }))))).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import type { IAnnouncement, IAnnouncementsSnapshot } from "@/models/Announcement";
import {
  hasBodyText,
  pageTarget,
  isForStation,
  resolveWebAction,
  slugFromHash,
  stationFirst,
  type AnnouncementsLocalState,
} from "@/utils/announcements";

const NOW = new Date("2026-11-12T10:00:00Z");

const announcement = (slug: string, extra: Partial<IAnnouncement> = {}): IAnnouncement =>
  ({
    slug,
    position: 0,
    category: { slug: "community", name: "c", color: "#0F6E63", text_color: "#FFFFFF" },
    icon: { name: "info", url: null },
    title: slug,
    body_html: "",
    button: null,
    secondary_button: null,
    page: null,
    dismissible: true,
    starts_at: null,
    ends_at: null,
    hide_after_seconds: null,
    max_impressions: null,
    ...extra,
  }) as IAnnouncement;

const emptyState = (extra: Partial<AnnouncementsLocalState> = {}): AnnouncementsLocalState => ({
  dismissed: {},
  impressions: {},
  rotationCursor: 0,
  seen: {},
  ...extra,
});

describe("slugFromHash", () => {
  it("reads the slug from #anunt/<slug>", () => {
    expect(slugFromHash("#anunt/concert-craciun")).toBe("concert-craciun");
    expect(slugFromHash("#anunt/")).toBeNull();
    expect(slugFromHash("#other")).toBeNull();
    expect(slugFromHash("")).toBeNull();
  });
});

describe("resolveWebAction", () => {
  const action = (extra: Record<string, unknown>) =>
    ({
      type: "external",
      url: null,
      web_target: null,
      android_intent_uri: null,
      fallback_url: null,
      station_slug: null,
      ...extra,
    }) as any;

  it("opens external links in a new tab unless same_tab is set", () => {
    expect(resolveWebAction(action({ url: "https://x.ro", web_target: "new_tab" }))).toEqual({
      kind: "link",
      href: "https://x.ro",
      newTab: true,
    });
    expect(resolveWebAction(action({ url: "https://x.ro", web_target: "same_tab" }))).toMatchObject({
      newTab: false,
    });
  });

  it("opens in_app_browser in a new tab and android_intent at its fallback_url", () => {
    expect(resolveWebAction(action({ type: "in_app_browser", url: "https://a.ro" }))).toMatchObject({
      href: "https://a.ro",
      newTab: true,
    });
    expect(
      resolveWebAction(
        action({ type: "android_intent", android_intent_uri: "intent://x", fallback_url: "https://f.ro" }),
      ),
    ).toMatchObject({ href: "https://f.ro", newTab: true });
  });

  it("goes to the station page in the same tab", () => {
    expect(resolveWebAction(action({ type: "station", station_slug: "radio-elim" }))).toEqual({
      kind: "link",
      href: "/radio-elim",
      newTab: false,
    });
  });

  it("rejects URLs that would run code", () => {
    for (const url of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(resolveWebAction(action({ url }))).toBeNull();
      expect(resolveWebAction(action({ type: "android_intent", fallback_url: url }))).toBeNull();
    }
  });

  it("allows web, mail and phone links and paths on this site", () => {
    for (const url of ["https://x.ro/a", "http://x.ro", "mailto:a@b.ro", "tel:+40700000000", "/radio-elim"]) {
      expect(resolveWebAction(action({ url }))).toMatchObject({ kind: "link", href: url });
    }
  });

  it("opens a form by its slug, and ignores unsafe or missing slugs", () => {
    expect(resolveWebAction(action({ type: "form", form_slug: "sondaj" }))).toEqual({ kind: "form", slug: "sondaj" });
    expect(resolveWebAction(action({ type: "form", form_slug: "../x" }))).toBeNull();
    expect(resolveWebAction(action({ type: "form" }))).toBeNull();
  });

  it("opens the page dialog, and has no button for none or missing URLs", () => {
    expect(resolveWebAction(action({ type: "page" }))).toEqual({ kind: "page" });
    expect(resolveWebAction(action({ type: "none" }))).toBeNull();
    expect(resolveWebAction(action({ type: "external" }))).toBeNull();
    expect(resolveWebAction(null)).toBeNull();
  });
});

describe("placement", () => {
  it("matches station announcements only on their stations", () => {
    const a = announcement("a", { placement: "station", station_slugs: ["radio-elim"] });
    expect(isForStation(a, "radio-elim")).toBe(true);
    expect(isForStation(a, "aripi-spre-cer")).toBe(false);
    expect(isForStation(announcement("b", { station_slugs: ["radio-elim"] }), "radio-elim")).toBe(false);
  });
});

describe("pageTarget", () => {
  it("moves within the list and stops at both ends", () => {
    expect(pageTarget(0, 3, 1)).toBe(1);
    expect(pageTarget(2, 3, -1)).toBe(1);
    expect(pageTarget(0, 3, -1)).toBeNull();
    expect(pageTarget(2, 3, 1)).toBeNull();
    expect(pageTarget(0, 1, 1)).toBeNull();
  });
});

describe("hasBodyText", () => {
  it("is false for missing or empty bodies", () => {
    for (const empty of [undefined, null, "", "  ", "<p></p>", "<p> &nbsp; </p>", "<br>"]) {
      expect(hasBodyText(empty)).toBe(false);
    }
  });

  it("is true when any text shows", () => {
    expect(hasBodyText("Primește-l <b>zilnic</b>")).toBe(true);
  });
});

describe("stationFirst", () => {
  const verse = announcement("versetul-zilei");
  const own = announcement("share-a-thon", { placement: "station", station_slugs: ["micul-samaritean"] });
  const other = announcement("alt-post", { placement: "station", station_slugs: ["alt-radio"] });
  const snapshot: IAnnouncementsSnapshot = {
    settings: { rotation_mode: "rotate" },
    announcements: [verse, own, other],
    built_at: 1,
  };

  it("puts the station's own announcements first in the card, in a fixed order", () => {
    const page = stationFirst(snapshot, "micul-samaritean");
    expect(page.announcements.map((a) => a.slug)).toEqual(["share-a-thon", "versetul-zilei", "alt-post"]);
    expect(page.announcements[0]).toMatchObject({ placement: "home", station_slugs: [] });
    expect(page.settings.rotation_mode).toBe("fixed");
    expect(page.station_slug).toBe("micul-samaritean");
  });

  it("keeps the order and rotation of a station without announcements", () => {
    const page = stationFirst(snapshot, "fara-anunturi");
    expect(page.announcements).toEqual(snapshot.announcements);
    expect(page.settings.rotation_mode).toBe("rotate");
  });

  it("leaves pages that are not a station's unchanged", () => {
    expect(stationFirst(snapshot)).toBe(snapshot);
  });

  // RadioApp applies it to every station's snapshot as the selected station changes in place
  it("follows a station change made without a page load", () => {
    const home = (page: IAnnouncementsSnapshot) =>
      page.announcements.filter((a) => (a.placement ?? "home") === "home").map((a) => a.slug);
    expect(home(stationFirst(snapshot, "micul-samaritean"))).toEqual(["share-a-thon", "versetul-zilei"]);
    expect(home(stationFirst(snapshot, "alt-radio"))).toEqual(["alt-post", "versetul-zilei"]);
    expect(home(stationFirst(snapshot))).toEqual(["versetul-zilei"]);
  });
});

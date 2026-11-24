// The show and hide rules (backend/docs/announcement-hide-rules.md), checked against the
// backend's shared cases, so the website, the app and the reference evaluator can't drift apart.
import { beforeEach, describe, expect, it } from "vitest";
import cases from "../../../../backend/docs/announcement-hide-rules.cases.json";
import type { IAnnouncement, IAnnouncementsSnapshot } from "@/models/Announcement";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import { countsAsHideClick, hiddenAtClick, withClick } from "@/utils/announcements";
import { annEligibility, toPrepaintData, type PrepaintLocal } from "@/utils/announcementsPrepaint";

const NOW = Date.parse("2026-11-24T10:00:00Z");

const emptyStore = { dismissed: {}, impressions: {}, clicks: {}, afterClicks: {}, started: {}, returns: {}, waited: {} };

const snapshotOf = (a: Partial<IAnnouncement>): IAnnouncementsSnapshot => ({
  built_at: NOW - 1000,
  settings: { rotation_mode: "fixed" },
  announcements: [{ slug: "a", title: "A", ...a }],
});

const shows = (a: Partial<IAnnouncement>, local: PrepaintLocal) => {
  const r = annEligibility(toPrepaintData(snapshotOf(a)), local, null, "ro-ro", NOW, 0);
  // the rules are per device, not per viewport
  expect(r.m.v).toEqual(r.d.v);
  return r.d.v.includes("a");
};

interface Counts {
  impressions?: number;
  clicks?: number;
  impressions_after_clicks?: number;
  dismissed?: boolean;
  started?: boolean;
  returns?: number;
  waited?: number;
}

/** What the store keeps for a device with these counts. */
const localOf = (c: Counts): PrepaintLocal => ({
  impressions: { a: c.impressions ?? 0 },
  clicks: { a: c.clicks ?? 0 },
  ...(c.impressions_after_clicks !== undefined && { afterClicks: { a: c.impressions_after_clicks } }),
  ...(c.dismissed && { dismissed: { a: "2026-11-01T00:00:00Z" } }),
  started: c.started ? { a: true } : {},
  returns: { a: c.returns ?? 0 },
  waited: { a: c.waited ?? 0 },
});

describe("hide rules: the backend's shared cases", () => {
  it.each(cases.hide_cases)("$name", ({ rules, counts, hidden_by }) => {
    expect(shows(rules as Partial<IAnnouncement>, localOf(counts))).toBe(hidden_by === null);
  });

  it.each(cases.click_cases)("click: $name", ({ hide_click_target, event, counts }) => {
    const e = event as { type: "clicked" | "dismissed" | "page_viewed" | "secondary_clicked"; target?: "card" | "button" | "link" };
    expect(countsAsHideClick(hide_click_target as "main" | "any" | null, e.type, e.target)).toBe(counts);
  });
});

describe("waits (show_after, show it again): the backend's shared cases", () => {
  beforeEach(() => useAnnouncementsStore.setState(emptyStore));

  it.each(cases.show_again_cases)("$name", ({ rules, counts, hidden, comes_back }) => {
    const a = { slug: "a", title: "A", ...(rules as Partial<IAnnouncement>) };
    const local = localOf(counts);
    const shown = shows(a, local);
    expect(shown).toBe(!hidden);
    // the visit: one that comes back starts a new round
    useAnnouncementsStore.setState({ dismissed: {}, ...local } as never);
    useAnnouncementsStore.getState().countVisit([a], shown ? ["a"] : []);
    const after = useAnnouncementsStore.getState();
    expect(after.returns.a).toBe((counts.returns ?? 0) + (comes_back ? 1 : 0));
    if (comes_back) {
      expect([after.impressions.a, after.clicks.a, after.afterClicks.a, after.waited.a]).toEqual([
        undefined, undefined, undefined, undefined,
      ]);
    }
    // shown: its show_after wait is over for good
    if (shown) expect(after.started.a).toBe(true);
  });

  // Replays like the backend's test: a visit step is a page load decided by the pre-paint code,
  // then counted by the store (visit, impression, click or close) as the website does; an event
  // step is another announcement's impression ('o') or a station playback ('p', 'p:<slug>').
  it.each(cases.timelines)("timeline: $name", ({ rules, steps }) => {
    const a = { slug: "a", title: "A", ...(rules as Partial<IAnnouncement>) };
    const other = { slug: "other", title: "Other" };
    const store = () => useAnnouncementsStore.getState();
    const seen = steps.map((step) => {
      if (step === "o") {
        store().countImpression("other", [a, other]);
        return step;
      }
      if (step.startsWith("p")) {
        store().countPlayback([a, other], step.slice(2) || "any-station");
        return step;
      }
      const shown = shows(a, store());
      store().countVisit([a], shown ? ["a"] : []);
      if (!shown) return "-";
      store().countImpression("a", [a, other]);
      if (step === "v+c") store().countClick(a, "button");
      else if (step === "x") store().dismiss("a");
      return step;
    });
    expect(seen).toEqual(steps);
  });

  it("show it again is left out of the pre-paint data without max impressions or click rules, or alone", () => {
    expect(toPrepaintData(snapshotOf({ show_again_times: 2, show_again_after: 3 })).i).toEqual([{ s: "a" }]);
    expect(toPrepaintData(snapshotOf({ max_impressions: 2, show_again_times: 2 })).i).toEqual([{ s: "a", m: 2 }]);
    expect(toPrepaintData(snapshotOf({ hide_after_clicks: 1, show_again_times: 2, show_again_after: 3 })).i)
      .toEqual([{ s: "a", c: 1, t: 2, u: 3 }]);
  });

  it("show_after goes into the pre-paint data on its own; count_on stays out (only counting needs it)", () => {
    expect(toPrepaintData(snapshotOf({ show_after: 40, count_on: "playbacks", count_station_slugs: ["radio-x"] })).i)
      .toEqual([{ s: "a", w: 40 }]);
  });

  it("counts nothing without a wait", () => {
    const a = { slug: "a", title: "A", max_impressions: 1 };
    useAnnouncementsStore.setState({ ...emptyStore, impressions: { a: 1 } });
    const store = useAnnouncementsStore.getState();
    store.countVisit([a], []);
    store.countPlayback([a], "radio-x");
    store.countImpression("b", [a]);
    expect(useAnnouncementsStore.getState().waited).toEqual({});
    expect(useAnnouncementsStore.getState().started).toEqual({});
  });

  it("a station change decided again counts as a visit, the playback in between too", () => {
    const a = { slug: "a", title: "A", count_on: "playbacks" as const, show_after: 2 };
    const store = () => useAnnouncementsStore.getState();
    store().countVisit([a], []);
    store().countPlayback([a], "radio-x");
    expect(shows(a, store())).toBe(false);
    store().countPlayback([a], "radio-y");
    expect(shows(a, store())).toBe(true);
    store().countVisit([a], ["a"]);
    expect([store().started.a, store().waited.a]).toEqual([true, undefined]);
  });
});

describe("hide rules: missing fields keep today's behaviour", () => {
  it("adds nothing to the pre-paint data without the new fields", () => {
    expect(toPrepaintData(snapshotOf({ max_impressions: 3, dismissible: true })).i).toEqual([{ s: "a", m: 3 }]);
  });

  it("counts no clicks without hide_after_clicks", () => {
    const state = { clicks: {}, afterClicks: {} };
    expect(withClick(state, { slug: "a" }, "button")).toBe(state);
  });

  it("drops impressions_after_click without hide_after_clicks", () => {
    expect(toPrepaintData(snapshotOf({ impressions_after_click: 2 })).i).toEqual([{ s: "a" }]);
  });
});

describe("hide rules: counting on a device", () => {
  beforeEach(() => useAnnouncementsStore.setState(emptyStore));
  const store = () => useAnnouncementsStore.getState();
  const showsNow = (a: Partial<IAnnouncement>) => shows(a, store());

  it("after one click: hidden at once, taken out of the current view", () => {
    const a = { slug: "a", title: "A", hide_after_clicks: 1 };
    store().countImpression("a");
    expect(showsNow(a)).toBe(true);
    expect(store().countClick(a, "button")).toBe(true);
    expect(showsNow(a)).toBe(false);
  });

  it("a link in the description doesn't count for main, does for any", () => {
    const main = { slug: "a", title: "A", hide_after_clicks: 1 };
    expect(store().countClick(main, "link")).toBe(false);
    expect(showsNow(main)).toBe(true);
    const any = { ...main, hide_click_target: "any" as const };
    expect(store().countClick(any, "link")).toBe(true);
    expect(showsNow(any)).toBe(false);
  });

  it("2 clicks + 2 impressions: the impression during the click isn't a reminder", () => {
    const a = { slug: "a", title: "A", hide_after_clicks: 2, impressions_after_click: 2 };
    store().countImpression("a");
    expect(store().countClick(a, "card")).toBe(false);
    store().countImpression("a"); // next load, before the 2nd click: not a reminder
    expect(store().countClick(a, "button")).toBe(false); // reminders follow: stays in view
    expect(store().afterClicks).toEqual({ a: 0 });
    expect(showsNow(a)).toBe(true);
    store().countImpression("a");
    expect(store().countClick(a, "button")).toBe(false); // a 3rd click doesn't restart the count
    expect(showsNow(a)).toBe(true);
    store().countImpression("a");
    expect(store().afterClicks).toEqual({ a: 2 });
    expect(showsNow(a)).toBe(false);
  });

  it("hiddenAtClick only without reminders", () => {
    expect(hiddenAtClick({ slug: "a", title: "A", hide_after_clicks: 1 }, { a: 1 })).toBe(true);
    expect(hiddenAtClick({ slug: "a", title: "A", hide_after_clicks: 1, impressions_after_click: 1 }, { a: 1 })).toBe(false);
    expect(hiddenAtClick({ slug: "a", title: "A", hide_after_clicks: 2 }, { a: 1 })).toBe(false);
  });
});

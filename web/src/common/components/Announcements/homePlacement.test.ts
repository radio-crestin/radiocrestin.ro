// SPEC "Website home placement v2": the card sits above "Stații favorite:" (or the search row
// without favourites), in the favourites' column, and stays while a search is typed.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { compile } from "sass";
import path from "path";
import { describe, expect, it } from "vitest";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import type { IStation } from "@/models/Station";
import { ContextProvider } from "@/context/ContextProvider";
import Stations from "@/components/Stations";
import { AnnouncementsProvider, prepareAnnouncementsMarkup } from "./index";

const css = compile(path.resolve(__dirname, "../../../../public/styles/_announcements.scss")).css.replace(/\s+/g, " ");

const snapshot = {
  built_at: 7,
  settings: { rotation_mode: "fixed" },
  announcements: [{ slug: "versetul-zilei", title: "Versetul Zilei", dismissible: true }],
} as unknown as IAnnouncementsSnapshot;

const station = (id: number, slug: string) =>
  ({ id, slug, title: slug, thumbnail_url: "", total_listeners: 0, reviews_stats: {} }) as unknown as IStation;
const stations = [station(1, "radio-a"), station(2, "radio-b")];

const renderStations = async (favourites: IStation[]) => {
  await prepareAnnouncementsMarkup(snapshot);
  const tree = createElement(AnnouncementsProvider, { snapshot, children: createElement(Stations) });
  return renderToString(
    createElement(ContextProvider, {
      initialState: { stations, selectedStation: null, favouriteStations: favourites },
      children: tree,
    }),
  );
};

describe("the home card's place", () => {
  it("comes before the favourites, outside the station grid", async () => {
    const html = await renderStations([stations[0]]);
    const card = html.indexOf("data-ann-r");
    expect(card).toBeGreaterThan(-1);
    expect(card).toBeLessThan(html.indexOf('data-info="favourite-section"'));
    expect(card).toBeLessThan(html.indexOf('data-info="stations-section"'));
    expect(html.slice(card - 200, card)).not.toMatch(/stations_container/);
    expect(html).toMatch(/<div data-ann-r="" data-ann-pp="" class="ann-slot ann-inHome/);
  });

  it("comes right before the search row when there are no favourites", async () => {
    const html = await renderStations([]);
    expect(html).not.toContain('data-info="favourite-section"');
    expect(html.indexOf("data-ann-r")).toBeLessThan(html.indexOf('data-info="stations-section"'));
  });

  it("is never hidden by the station search (only when nothing is left to show)", async () => {
    const html = await renderStations([]);
    expect(html.match(/<div data-ann-r=""[^>]*>/)?.[0]).not.toContain("hidden");
  });

  it("uses the favourites section's box, and the old grid slot is gone", () => {
    const home = css.slice(css.indexOf(".ann-inHome {"), css.indexOf("}", css.indexOf(".ann-inHome {")));
    expect(home).toMatch(/max-width: 1230px;.*width: 100%;.*margin: 36px auto 0/);
    expect(css).toMatch(/@media screen and \(max-width: 1378px\) \{ \.ann-inHome \{ width: calc\(100% - 30px\); padding: 0 15px; \} \}/);
    expect(css).not.toContain("ann-inGrid");
  });
});

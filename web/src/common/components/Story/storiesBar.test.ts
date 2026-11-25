// The stories bar's server markup (above the announcements), from fixture JSON.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import fixture from "@/components/Story/fixtures/stories.json";
import StoriesBar, { StoriesProvider } from "@/components/Story/StoriesBar";
import { toStoryBubble } from "@/utils/stories";

const render = (stories: unknown[]) =>
  renderToString(createElement(StoriesProvider, { stories: stories.map((s) => toStoryBubble(s)!) }, createElement(StoriesBar)));

describe("StoriesBar", () => {
  it("renders a bubble per story: its picture, title and share page link", () => {
    const html = render([fixture.stories[0], { ...fixture.stories[0], slug: "alta", title: "Alta", cover_url: null }]);
    expect(html).toContain('data-testid="stories-bar"');
    expect(html).toContain('href="/poveste/concert-craciun-2026/"');
    expect(html).toContain('src="https://cdn.radiocrestin.ro/stories/covers/concert.webp"');
    expect(html).toContain(">Concert de Crăciun<");
    expect(html).toContain('href="/poveste/alta/"');
    // Before this device's history is read, every ring is coloured (new).
    expect(html.match(/poveste nouă/g)).toHaveLength(2);
  });
  it("renders nothing without stories", () => {
    expect(render([])).toBe("");
  });
});

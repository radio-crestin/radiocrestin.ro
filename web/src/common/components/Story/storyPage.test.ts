// The share page's server markup (what a built page shows before hydration), from fixture JSON.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import fixture from "@/components/Story/fixtures/stories.json";
import StoryPage from "@/components/Story/StoryPage";
import { toStoryView } from "@/utils/stories";

describe("StoryPage", () => {
  it("renders the story's title, first slide, CTA and store links", () => {
    const html = renderToString(createElement(StoryPage, { story: toStoryView(fixture.stories[0]) }));
    expect(html).toContain("Concert de Crăciun");
    expect(html).toContain('src="https://cdn.radiocrestin.ro/stories/slides/afis.webp"');
    expect(html).toContain('href="/radio-vocea-evangheliei/"');
    expect(html).toContain("Ascultă acum");
    // The player: one progress bar per slide, like and share, nothing playing before load.
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html).toContain('data-ready="0"');
    expect(html).toContain('aria-label="Îmi place"');
    expect(html).toContain(">152<");
    expect(html).toContain('aria-label="Distribuie"');
    // The CTA bar is there from the start, glassy (its colour sweeps in after 2 s of play).
    expect(html).toContain('data-filled="0"');
    expect(html).toContain(">Trimite<");
    expect(html).toContain("apps.apple.com");
    expect(html).toContain("play.google.com");
    expect(html).toContain('href="/"');
  });
  it("the fallback page starts loading", () => {
    const html = renderToString(createElement(StoryPage, {}));
    expect(html).toContain("Se încarcă povestea");
  });
});

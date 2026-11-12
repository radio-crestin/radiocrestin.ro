import { describe, expect, it } from "vitest";
import { parseEmbed, watchUrl } from "@/utils/youtubeEmbed";

const attrs = (values: Record<string, string>) => (name: string) => values[name] ?? null;
const base = { "data-provider": "youtube" };

describe("parseEmbed", () => {
  it("reads videos, shorts and playlists", () => {
    expect(parseEmbed(attrs({ ...base, "data-kind": "video", "data-video-id": "dQw4w9WgXcQ", "data-start": "62" }))).toEqual({
      kind: "video",
      videoId: "dQw4w9WgXcQ",
      listId: undefined,
      start: 62,
      title: undefined,
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
    expect(parseEmbed(attrs({ ...base, "data-kind": "short", "data-video-id": "abcdefghijk" }))?.kind).toBe("short");
    expect(parseEmbed(attrs({ ...base, "data-kind": "playlist", "data-list-id": "PLabcdefghij123" }))).toMatchObject({
      kind: "playlist",
      listId: "PLabcdefghij123",
    });
  });

  it("rejects hostile or malformed attributes", () => {
    for (const bad of [
      { ...base, "data-kind": "video", "data-video-id": 'x" onload="alert(1)' },
      { ...base, "data-kind": "video", "data-video-id": "../../evil/x" },
      { ...base, "data-kind": "video", "data-video-id": "dQw4w9WgXcQ?autoplay=1&x=" },
      { ...base, "data-kind": "video", "data-video-id": "short" },
      { ...base, "data-kind": "playlist", "data-list-id": "PL<script>" },
      { ...base, "data-kind": "video", "data-video-id": "dQw4w9WgXcQ", "data-start": "1;alert(1)" },
      { ...base, "data-kind": "channel", "data-video-id": "dQw4w9WgXcQ" },
      { "data-provider": "vimeo", "data-kind": "video", "data-video-id": "dQw4w9WgXcQ" },
      { ...base, "data-kind": "playlist" },
      { ...base, "data-kind": "video" },
    ]) {
      expect(parseEmbed(attrs(bad))).toBeNull();
    }
  });
});

describe("titles and thumbnails", () => {
  const video = { ...base, "data-kind": "video", "data-video-id": "dQw4w9WgXcQ" };
  const playlist = { ...base, "data-kind": "playlist", "data-list-id": "PLabcdefghij123" };

  it("uses data-title and an i.ytimg.com data-thumbnail", () => {
    const thumb = "https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=x";
    expect(parseEmbed(attrs({ ...playlist, "data-title": "  Cântări  ", "data-thumbnail": thumb }))).toMatchObject({
      title: "Cântări",
      thumbnail: thumb,
    });
  });

  it("drops a thumbnail from anywhere else, keeping the embed", () => {
    for (const bad of [
      "http://i.ytimg.com/vi/x/hq.jpg",
      "https://i.ytimg.com.evil.example/x.jpg",
      "https://user@i.ytimg.com/x.jpg",
      "https://i.ytimg.com:8443/x.jpg",
      "javascript:alert(1)",
      "//i.ytimg.com/x.jpg",
    ]) {
      expect(parseEmbed(attrs({ ...playlist, "data-thumbnail": bad }))).toMatchObject({ thumbnail: undefined });
      expect(parseEmbed(attrs({ ...video, "data-thumbnail": bad }))?.thumbnail).toBe(
        "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      );
    }
  });

  it("caps the title at 200 characters", () => {
    expect(parseEmbed(attrs({ ...video, "data-title": "x".repeat(300) }))?.title).toHaveLength(200);
  });
});

describe("watchUrl", () => {
  it("builds canonical youtube.com URLs", () => {
    expect(watchUrl({ kind: "video", videoId: "dQw4w9WgXcQ", start: 62 })).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
    );
    expect(watchUrl({ kind: "video", videoId: "dQw4w9WgXcQ", listId: "PLabcdefghij123" })).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij123",
    );
    expect(watchUrl({ kind: "short", videoId: "abcdefghijk" })).toBe("https://www.youtube.com/shorts/abcdefghijk");
    expect(watchUrl({ kind: "playlist", listId: "PLabcdefghij123" })).toBe(
      "https://www.youtube.com/playlist?list=PLabcdefghij123",
    );
  });
});

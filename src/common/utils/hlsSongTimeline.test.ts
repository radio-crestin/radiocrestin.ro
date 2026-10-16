import { describe, it, expect } from "vitest";
import {
  HlsSongTimeline,
  parseHlsAttributeList,
  parseSongBoundaries,
  songFromHint,
} from "@/utils/hlsSongTimeline";

// Header of a live radio-emanuel playlist (2026-10-15 17:18 UTC).
const PLAYLIST = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1792007485
#EXT-X-START:TIME-OFFSET=-18
#EXT-X-DATERANGE:ID="song-1792084054085",START-DATE="2026-10-15T17:07:34.084Z",END-DATE="2026-10-15T17:11:37.331Z",X-TITLE="Temeiul cantarilor mele",X-ARTIST="Alina Calina"
#EXT-X-DATERANGE:ID="song-1792084297331",START-DATE="2026-10-15T17:11:37.331Z",END-DATE="2026-10-15T17:15:09.342Z",X-TITLE="Da-ne lumina",X-ARTIST="Carmen Prodan"
#EXT-X-RC-METADATA-CHANGED:STARTED-AT="2026-10-15T17:15:09.000Z",EPOCH=1792084509,X-TITLE="Dumnezeu nemuritor",X-ARTIST="Corina Petre",X-SONG-ID="31775",X-ARTIST-ID="4308"
#EXTINF:5.990744,
#EXT-X-PROGRAM-DATE-TIME:2026-10-15T17:06:07.715+0000
radio-emanuel-1791992185-1792007491.ts
`;

const at = (iso: string) => Date.parse(iso);

describe("parseHlsAttributeList", () => {
  it("keeps commas and = inside quoted values", () => {
    expect(parseHlsAttributeList('X-TITLE="Tu, Doamne = viata",EPOCH=12,X-ARTIST="A"')).toEqual({
      "X-TITLE": "Tu, Doamne = viata",
      EPOCH: "12",
      "X-ARTIST": "A",
    });
  });

  it("ignores an unterminated quoted value", () => {
    expect(parseHlsAttributeList('EPOCH=12,X-TITLE="broken')).toEqual({ EPOCH: "12" });
  });
});

describe("parseSongBoundaries", () => {
  it("reads DATERANGE starts/ends and the current song's EPOCH with its hint", () => {
    const boundaries = parseSongBoundaries(PLAYLIST);
    expect(boundaries.map((b) => b.at)).toEqual([
      at("2026-10-15T17:07:34.084Z"),
      at("2026-10-15T17:11:37.331Z"),
      at("2026-10-15T17:11:37.331Z"),
      at("2026-10-15T17:15:09.342Z"),
      1792084509_000,
    ]);
    // DATERANGE titles can be raw stream text: they are not used as hints.
    expect(boundaries.slice(0, 4).every((b) => b.hint === null)).toBe(true);
    expect(boundaries[4].hint).toEqual({
      title: "Dumnezeu nemuritor",
      artist: "Corina Petre",
      songId: 31775,
      artistId: 4308,
      thumbnailUrl: undefined,
    });
  });

  it("treats a METADATA-CHANGED without X-* attributes as a hintless boundary", () => {
    const [b] = parseSongBoundaries('#EXT-X-RC-METADATA-CHANGED:STARTED-AT="x",EPOCH=1792084509');
    expect(b).toEqual({ at: 1792084509_000, hint: null });
  });

  it("drops a non-http thumbnail", () => {
    const [b] = parseSongBoundaries(
      '#EXT-X-RC-METADATA-CHANGED:EPOCH=1,X-TITLE="T",X-SONG-ID="2",X-THUMBNAIL-URL="javascript:alert(1)"',
    );
    expect(b.hint?.thumbnailUrl).toBeUndefined();
  });
});

describe("songFromHint", () => {
  it("builds the API-shaped song from a complete hint", () => {
    expect(songFromHint({ title: "T", artist: "A", songId: 5, artistId: 6, thumbnailUrl: "https://x/t.jpg" })).toEqual({
      id: 5,
      name: "T",
      thumbnail_url: "https://x/t.jpg",
      artist: { id: 6, name: "A", thumbnail_url: null },
    });
  });

  it("refuses a hint without song id or title", () => {
    expect(songFromHint({ title: "Raw ICY text" })).toBeNull();
    expect(songFromHint({ songId: 5, title: "  " })).toBeNull();
    expect(songFromHint(null)).toBeNull();
  });
});

describe("HlsSongTimeline", () => {
  it("picks the song audible at the playhead, 2 min behind live", () => {
    const timeline = new HlsSongTimeline();
    timeline.add(parseSongBoundaries(PLAYLIST));
    // Before the last DATERANGE ended: still "Da-ne lumina" (no hint).
    const before = timeline.songChangeAt(at("2026-10-15T17:15:08.000Z"));
    expect(before?.at).toBe(at("2026-10-15T17:11:37.331Z"));
    // Past it: the current song, merged with its EPOCH hint.
    const after = timeline.songChangeAt(at("2026-10-15T17:15:10.000Z"));
    expect(songFromHint(after!.hint)?.id).toBe(31775);
    expect(timeline.songChangeAt(at("2026-10-15T17:00:00.000Z"))).toBeNull();
  });

  it("merges the EPOCH and DATERANGE of one change into one boundary", () => {
    const timeline = new HlsSongTimeline();
    timeline.add(parseSongBoundaries(PLAYLIST));
    const a = timeline.songChangeAt(at("2026-10-15T17:15:09.400Z"));
    const b = timeline.songChangeAt(at("2026-10-15T17:16:00.000Z"));
    expect(a).toBe(b);
    // First sighting keeps its instant (the DATERANGE END-DATE here).
    expect(a?.at).toBe(at("2026-10-15T17:15:09.342Z"));
  });

  it("keeps identity across reloads, and changes it only when a hint arrives", () => {
    const timeline = new HlsSongTimeline();
    timeline.add([{ at: 1_000_000, hint: null }]);
    const bare = timeline.songChangeAt(1_000_500);
    timeline.add([{ at: 1_000_000, hint: null }]);
    expect(timeline.songChangeAt(1_000_500)).toBe(bare);

    const hint = { title: "T", songId: 5 };
    timeline.add([{ at: 1_000_000, hint }]);
    const hinted = timeline.songChangeAt(1_000_500);
    expect(hinted).not.toBe(bare);
    expect(hinted?.hint).toEqual(hint);

    // The same hint again, or no hint, keeps it.
    timeline.add([{ at: 1_000_000, hint: { title: "T", songId: 5 } }, { at: 1_000_000, hint: null }]);
    expect(timeline.songChangeAt(1_000_500)).toBe(hinted);
  });

  it("keeps a bounded number of boundaries, dropping the oldest", () => {
    const timeline = new HlsSongTimeline();
    timeline.add(Array.from({ length: 100 }, (_, i) => ({ at: i * 10_000, hint: null })));
    expect(timeline.songChangeAt(0)).toBeNull();
    expect(timeline.songChangeAt(99 * 10_000)?.at).toBe(99 * 10_000);
  });
});

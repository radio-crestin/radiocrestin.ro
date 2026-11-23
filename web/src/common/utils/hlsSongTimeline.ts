import type { ISong } from "@/models/Station";

// Song changes the HLS playlist announces, matched against the audio the
// listener hears (same model as the mobile app's SongBoundaryQueue).
//
// The backend rewrites every media playlist with:
//   #EXT-X-DATERANGE:START-DATE=…,END-DATE=…   one per song that already ended
//   #EXT-X-RC-METADATA-CHANGED:EPOCH=…,X-TITLE=…,X-ARTIST=…,X-SONG-ID=…
//                                              the song currently on air
// All of them are server wall-clock instants, like EXT-X-PROGRAM-DATE-TIME,
// so hls.playingDate (PDT of the playhead) says which one is audible.

const METADATA_CHANGED_TAG = "#EXT-X-RC-METADATA-CHANGED:";
const DATERANGE_TAG = "#EXT-X-DATERANGE:";

/** Boundaries closer than this are the same song change (EPOCH vs the
 *  previous song's END-DATE vs the next song's START-DATE). */
const SAME_CHANGE_MS = 2000;

/** Boundaries kept, newest last. An ~11 min playlist window holds ~40 even
 *  over short items. */
const MAX_BOUNDARIES = 64;

/**
 * Song attributes of an EXT-X-RC-METADATA-CHANGED tag. The backend only
 * emits them once the API accepted that exact song instance, so they equal
 * the API's row and can be shown without a request.
 */
export interface ISongHint {
  title?: string;
  artist?: string;
  songId?: number;
  artistId?: number;
  thumbnailUrl?: string;
}

/** A song change, in server wall-clock epoch ms. */
export interface ISongBoundary {
  at: number;
  hint: ISongHint | null;
}

/**
 * Parses an RFC 8216 §4.2 attribute list (`NAME=value,NAME="quoted, value"`).
 * Quoted strings may contain commas and `=`, so the list is scanned rather
 * than split. The first occurrence of a name wins.
 */
export const parseHlsAttributeList = (text: string): Record<string, string> => {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < text.length) {
    const eq = text.indexOf("=", i);
    if (eq < 0) break;
    const name = text.slice(i, eq).trim();
    i = eq + 1;
    let value: string;
    if (text[i] === '"') {
      const close = text.indexOf('"', i + 1);
      if (close < 0) break; // unterminated quoted string
      value = text.slice(i + 1, close);
      const comma = text.indexOf(",", close + 1);
      i = comma < 0 ? text.length : comma + 1;
    } else {
      const comma = text.indexOf(",", i);
      const end = comma < 0 ? text.length : comma;
      value = text.slice(i, end).trim();
      i = end + 1;
    }
    if (name && !(name in result)) result[name] = value;
  }
  return result;
};

const positiveId = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const id = Number(value.trim());
  return id > 0 ? id : undefined;
};

const hintFrom = (attrs: Record<string, string>): ISongHint | null => {
  const text = (key: string) => attrs[key]?.trim() || undefined;
  const thumbnail = text("X-THUMBNAIL-URL");
  const hint: ISongHint = {
    title: text("X-TITLE"),
    artist: text("X-ARTIST"),
    songId: positiveId(attrs["X-SONG-ID"]),
    artistId: positiveId(attrs["X-ARTIST-ID"]),
    thumbnailUrl: thumbnail && /^https?:\/\//.test(thumbnail) ? thumbnail : undefined,
  };
  return Object.values(hint).some((v) => v !== undefined) ? hint : null;
};

/**
 * Every song change a media playlist announces: the EPOCH of
 * EXT-X-RC-METADATA-CHANGED (with its hint) and the START-DATE / END-DATE of
 * each EXT-X-DATERANGE. DATERANGE titles are not used: they can be raw
 * stream text that disagrees with the API.
 */
export const parseSongBoundaries = (m3u8: string): ISongBoundary[] => {
  const boundaries: ISongBoundary[] = [];
  for (const raw of m3u8.split("\n")) {
    const line = raw.trim();
    if (line.startsWith(METADATA_CHANGED_TAG)) {
      const attrs = parseHlsAttributeList(line.slice(METADATA_CHANGED_TAG.length));
      const epoch = positiveId(attrs.EPOCH);
      if (epoch !== undefined) boundaries.push({ at: epoch * 1000, hint: hintFrom(attrs) });
    } else if (line.startsWith(DATERANGE_TAG)) {
      const attrs = parseHlsAttributeList(line.slice(DATERANGE_TAG.length));
      for (const key of ["START-DATE", "END-DATE"]) {
        const at = Date.parse(attrs[key] ?? "");
        if (Number.isFinite(at)) boundaries.push({ at, hint: null });
      }
    }
  }
  return boundaries;
};

/**
 * The song a complete hint describes (song id and a non-blank title), in the
 * API's shape; null otherwise — a title-only hint is raw stream text.
 */
export const songFromHint = (hint: ISongHint | null): ISong | null => {
  const title = hint?.title?.trim();
  if (!hint || hint.songId === undefined || !title) return null;
  return {
    id: hint.songId,
    name: title,
    thumbnail_url: hint.thumbnailUrl ?? null,
    artist: { id: hint.artistId ?? 0, name: hint.artist?.trim() ?? "", thumbnail_url: null },
  };
};

const sameHint = (a: ISongHint | null, b: ISongHint | null) =>
  a === b ||
  (!!a && !!b &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.songId === b.songId &&
    a.artistId === b.artistId &&
    a.thumbnailUrl === b.thumbnailUrl);

/**
 * Song changes seen across the reloads of one live playlist.
 *
 * Boundary objects keep their identity until their hint changes, so a caller
 * can compare `songChangeAt()` results with `===` to detect "a different
 * song, or the same one with a new hint".
 */
export class HlsSongTimeline {
  private boundaries: ISongBoundary[] = [];

  /**
   * Adds new boundaries. A known one (within 2 s) keeps its instant and may
   * only gain or update a hint, never lose one: the backend publishes an
   * EPOCH first without, and seconds later with, its hint.
   */
  add(incoming: ISongBoundary[]): void {
    for (const b of incoming) {
      const i = this.boundaries.findIndex((e) => Math.abs(e.at - b.at) <= SAME_CHANGE_MS);
      if (i < 0) {
        this.boundaries.push(b);
      } else if (b.hint && !sameHint(b.hint, this.boundaries[i].hint)) {
        this.boundaries[i] = { at: this.boundaries[i].at, hint: b.hint };
      }
    }
    this.boundaries.sort((a, b) => a.at - b.at);
    if (this.boundaries.length > MAX_BOUNDARIES) {
      this.boundaries.splice(0, this.boundaries.length - MAX_BOUNDARIES);
    }
  }

  /** The change that started the song audible at `instant` (epoch ms): the
   *  newest boundary at or before it. */
  songChangeAt(instant: number): ISongBoundary | null {
    let found: ISongBoundary | null = null;
    for (const b of this.boundaries) {
      if (b.at > instant) break;
      found = b;
    }
    return found;
  }
}

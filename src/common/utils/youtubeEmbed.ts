// YouTube embeds in an announcement's page (SPEC "YouTube embeds in the announcement page",
// UPDATE 2). The backend leaves a placeholder <figure class="rc-embed" data-provider="youtube" …>;
// the website shows it as a thumbnail link that opens the video on YouTube. The link and the
// image are built only from these validated attributes, never from the HTML around them.

export type EmbedKind = "video" | "playlist" | "short";

export interface YouTubeEmbed {
  kind: EmbedKind;
  videoId?: string;
  listId?: string;
  /** seconds */
  start?: number;
  /** oEmbed title, plain text */
  title?: string;
  /** https://i.ytimg.com/… */
  thumbnail?: string;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const KINDS: EmbedKind[] = ["video", "playlist", "short"];

const ytimg = (raw: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" && !url.username && !url.port
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

/** The embed described by a placeholder's data attributes, or null if any of them is off. */
export const parseEmbed = (attrs: (name: string) => string | null): YouTubeEmbed | null => {
  if (attrs("data-provider") !== "youtube") return null;
  const kind = attrs("data-kind") as EmbedKind;
  if (!KINDS.includes(kind)) return null;
  const videoId = attrs("data-video-id") || undefined;
  const listId = attrs("data-list-id") || undefined;
  const startRaw = attrs("data-start");
  if (videoId !== undefined && !VIDEO_ID.test(videoId)) return null;
  if (listId !== undefined && !LIST_ID.test(listId)) return null;
  if (kind === "playlist" ? !listId : !videoId) return null;
  let start: number | undefined;
  if (startRaw) {
    if (!/^\d{1,6}$/.test(startRaw)) return null;
    start = Number(startRaw) || undefined;
  }
  // a bad title or thumbnail only loses that detail
  const title = attrs("data-title")?.trim().slice(0, 200) || undefined;
  const thumbnail = ytimg(attrs("data-thumbnail")) ?? (videoId && `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  return { kind, videoId, listId, start, title, thumbnail: thumbnail || undefined };
};

/** The canonical youtube.com URL the embed opens. */
export const watchUrl = (e: YouTubeEmbed): string => {
  if (e.kind === "short") return `https://www.youtube.com/shorts/${e.videoId}`;
  if (!e.videoId) return `https://www.youtube.com/playlist?list=${e.listId}`;
  const params = new URLSearchParams({ v: e.videoId });
  if (e.listId) params.set("list", e.listId);
  if (e.start) params.set("t", `${e.start}s`);
  return `https://www.youtube.com/watch?${params}`;
};

// Turns the backend's YouTube placeholders in an announcement page into thumbnail links with a
// play button that open the video on YouTube (a new tab, or the YouTube app on phones).
import { parseEmbed, watchUrl, type EmbedKind, type YouTubeEmbed } from "@/utils/youtubeEmbed";
import { T } from "./strings";

const PLAY_BADGE =
  '<svg viewBox="0 0 68 48" aria-hidden="true" focusable="false"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#f00"/><path d="M45 24 27 14v20Z" fill="#fff"/></svg>';

const accessibleName = ({ kind, title }: YouTubeEmbed) => {
  if (kind === "playlist") return title ? T.openPlaylist(title) : T.openPlaylistGeneric;
  if (kind === "short") return title ? T.openShort(title) : T.openShortGeneric;
  return title ? T.openVideo(title) : T.openVideoGeneric;
};

/** Replaces every valid placeholder in `container`; `onOpen` runs when one is clicked. */
export const enhanceYouTubeEmbeds = (container: HTMLElement, onOpen: (kind: EmbedKind) => void) => {
  container.querySelectorAll<HTMLElement>("figure.rc-embed").forEach((figure) => {
    const embed = parseEmbed((name) => figure.getAttribute(name));
    if (!embed || figure.dataset.enhanced) return; // invalid ones stay as the backend wrote them
    figure.dataset.enhanced = "1";

    const link = document.createElement("a");
    link.className = "ann-ytLink";
    link.href = watchUrl(embed);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", accessibleName(embed));
    if (embed.thumbnail) {
      const img = document.createElement("img");
      img.src = embed.thumbnail;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      link.append(img);
    }
    const badge = document.createElement("span");
    badge.className = "ann-ytBadge";
    badge.innerHTML = PLAY_BADGE;
    link.append(badge);
    link.addEventListener("click", () => onOpen(embed.kind));
    figure.replaceChildren(link);
  });
};

import {
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type SyntheticEvent,
} from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import ShareOnSocial from "@/components/ShareOnSocial";
import NavMenu from "@/components/NavMenu";
import StationRating from "@/components/Reviews/StationRating";
import SongHistory from "@/components/SongHistory";
import songHistoryStyles from "@/components/SongHistory/styles.module.scss";
import usePlaybackState from "@/store/usePlaybackState";
import { PLAYBACK_STATE } from "@/models/enum";
import PlayIcon from "@/icons/Play";
import { getValidImageUrl, roPlural } from "@/utils";
import { getStationColors } from "@/utils/stationColors";

const DEFAULT_STATION_IMG = "/images/radio-white-default.jpg";
const handleImgError = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.src = DEFAULT_STATION_IMG;
};

// Outbound station links carry ?ref= so stations can see the traffic we
// send them; URL() keeps existing query strings/fragments intact
const withRef = (url: string) => {
  try {
    const u = new URL(url);
    u.searchParams.set("ref", "radiocrestin.ro");
    return u.toString();
  } catch {
    return url;
  }
};

// Station-color ambience for the hero, drawn into a canvas instead of CSS
// gradients: browsers rasterize gradients at 8 bits/channel, so long soft
// fades over a dark ground show visible banding lines (worst on wide-gamut
// displays). Rendering per-pixel lets us add ±1-level noise before
// quantization — proper dithering, invisible as texture, no bands.
const WASH_W = 1400;
const WASH_H = 680;
const WASH_ALPHA_A = 0.22;
const WASH_ALPHA_B = 0.16;
const WASH_FADE_END = 0.46; // tint fully dissolved at 46% of height

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const StationWash = ({ primary, secondary }: { primary: string; secondary: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const a = hexToRgb(primary);
    const b = hexToRgb(secondary);
    // Blend in linear light so midpoints stay lively instead of muddy
    const lin = (c: number) => Math.pow(c / 255, 2.2);
    const gam = (c: number) => Math.pow(c, 1 / 2.2) * 255;
    const A = a.map(lin);
    const B = b.map(lin);

    const img = ctx2d.createImageData(WASH_W, WASH_H);
    const data = img.data;
    let i = 0;
    for (let y = 0; y < WASH_H; y++) {
      const fade = 1 - smoothstep(y / WASH_H / WASH_FADE_END);
      for (let x = 0; x < WASH_W; x++) {
        // ~100deg blend: mostly left→right with a slight vertical drift
        const t = smoothstep((x / WASH_W) * 0.92 + (y / WASH_H) * 0.08);
        const alpha = (WASH_ALPHA_A + (WASH_ALPHA_B - WASH_ALPHA_A) * t) * fade;
        // ±1-level noise dithers the quantization steps away
        const n = (Math.random() - 0.5) * 2.5;
        data[i++] = gam(A[0] + (B[0] - A[0]) * t) + n;
        data[i++] = gam(A[1] + (B[1] - A[1]) * t) + n;
        data[i++] = gam(A[2] + (B[2] - A[2]) * t) + n;
        data[i++] = alpha * 255 + (Math.random() - 0.5) * 2.5;
      }
    }
    ctx2d.putImageData(img, 0, 0);
  }, [primary, secondary]);

  return (
    <canvas
      ref={canvasRef}
      width={WASH_W}
      height={WASH_H}
      className={styles.wash}
      aria-hidden="true"
    />
  );
};

const PauseIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 5.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-1A1.5 1.5 0 0 1 7 18.5v-13zM13 5.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-13z" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    width={15}
    height={15}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.4 21v-8.2h2.76l.42-3.2H13.4V7.55c0-.93.26-1.56 1.59-1.56h1.7V3.13C16.4 3.09 15.4 3 14.24 3c-2.45 0-4.12 1.49-4.12 4.23v2.36H7.35v3.2h2.77V21h3.28z" />
  </svg>
);

const Navigation = () => (
  <nav className={styles.nav}>
    <div className={styles.internal_links}>
      <a href={"/"} className={styles.logo}>
        <img
          loading={"lazy"}
          src={"/images/radiocrestin_logo.png"}
          width={40}
          height={40}
          alt={"Logo Radio Creștin"}
        />
        <span>Radio Creștin</span>
      </a>
    </div>
    <NavMenu />
  </nav>
);

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Auto-open history modal if on /recent-songs route
  useEffect(() => {
    if (window.location.pathname.includes("/recent-songs")) {
      setIsHistoryOpen(true);
    }
  }, []);

  const handleOpenHistory = useCallback(() => {
    if (!selectedStation) return;
    setIsHistoryOpen(true);
    window.history.pushState(null, "", `/${selectedStation.slug}/recent-songs/`);
  }, [selectedStation]);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
    if (selectedStation) {
      window.history.replaceState(null, "", `/${selectedStation.slug}/`);
    }
  }, [selectedStation]);

  // The bottom player's "now playing" menu asks for the history modal via event
  useEffect(() => {
    const onOpenRequest = () => handleOpenHistory();
    window.addEventListener("rc:open-song-history", onOpenRequest);
    return () => window.removeEventListener("rc:open-song-history", onOpenRequest);
  }, [handleOpenHistory]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      const onRecentSongs = window.location.pathname.includes("/recent-songs");
      setIsHistoryOpen(onRecentSongs);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const song = selectedStation?.now_playing?.song;

  // Two-phase text swap: the rendered title/artist trail the live data by
  // one 170ms fade-out, then the new text fades in. Plays for the SSR'd
  // station name → live song handoff, song changes and station switches;
  // memoized on primitives so live polls with unchanged data are no-ops.
  const liveInfo = useMemo(
    () =>
      song?.name
        ? { kind: "song" as const, name: song.name, artist: song.artist?.name || "" }
        : { kind: "station" as const, name: selectedStation?.title || "", artist: "" },
    [song?.name, song?.artist?.name, selectedStation?.title]
  );
  const [shownInfo, setShownInfo] = useState(liveInfo);
  const [infoAnim, setInfoAnim] = useState<"" | "leave" | "enter">("");
  const liveInfoRef = useRef(liveInfo);
  liveInfoRef.current = liveInfo;

  useEffect(() => {
    const changed =
      liveInfo.kind !== shownInfo.kind ||
      liveInfo.name !== shownInfo.name ||
      liveInfo.artist !== shownInfo.artist;
    if (!changed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShownInfo(liveInfo);
      setInfoAnim("");
      return;
    }
    setInfoAnim("leave");
    const t = window.setTimeout(() => {
      setShownInfo(liveInfoRef.current);
      setInfoAnim("enter");
    }, 170);
    return () => window.clearTimeout(t);
  }, [liveInfo, shownInfo]);

  if (!selectedStation) return null;

  const songThumb =
    song?.thumbnail_url && getValidImageUrl(song.thumbnail_url) !== DEFAULT_STATION_IMG
      ? getValidImageUrl(song.thumbnail_url)
      : null;

  return (
    <div className={styles.left_content}>
      <div className={styles.np_card}>
        <div className={styles.np_header}>
          <span className={styles.live_dot} />
          <span>Se redă acum</span>
        </div>
        {songThumb ? (
          <div className={styles.container_img_plus_thumb}>
            <img
              loading={"lazy"}
              src={songThumb}
              alt={selectedStation.title}
              width={224}
              height={224}
              onError={handleImgError}
            />
            <img
              loading={"lazy"}
              src={getValidImageUrl(selectedStation.thumbnail_url)}
              alt={selectedStation.title}
              className={styles.img_thumb}
              width={224}
              height={224}
              onError={handleImgError}
            />
          </div>
        ) : (
          <img
            loading={"lazy"}
            src={getValidImageUrl(selectedStation.thumbnail_url)}
            alt={selectedStation.title}
            width={224}
            height={224}
            onError={handleImgError}
          />
        )}
        <div
          className={`${styles.station_info} ${
            infoAnim === "leave"
              ? styles.info_leave
              : infoAnim === "enter"
                ? styles.info_enter
                : ""
          }`}
        >
          {shownInfo.kind === "song" ? (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                `${shownInfo.name} ${shownInfo.artist}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.youtube_link}
              title="Deschide pe YouTube"
            >
              {/* Icon outside the clamp box: long titles ellipsize but the
                  YouTube glyph stays pinned to the right, always visible */}
              <div className={styles.title_row}>
                <h2>{shownInfo.name}</h2>
                <img
                  src="/icons/youtube.svg"
                  alt="YouTube"
                  width={18}
                  height={18}
                  className={styles.youtube_icon}
                />
              </div>
              <p>{shownInfo.artist}</p>
            </a>
          ) : (
            <>
              <h2>{shownInfo.name}</h2>
              <p>Transmisiune live</p>
            </>
          )}
        </div>
        <a
          className={`${songHistoryStyles.history_button} ${styles.np_history_button}`}
          href={`/${selectedStation.slug}/recent-songs/`}
          onClick={(e) => {
            e.preventDefault();
            handleOpenHistory();
          }}
          title="Melodii redate recent"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Melodii redate recent
        </a>
        <SongHistory
          stationSlug={selectedStation.slug}
          stationTitle={selectedStation.title}
          stationThumbnailUrl={selectedStation.thumbnail_url}
          isOpen={isHistoryOpen}
          onClose={handleCloseHistory}
        />
      </div>
    </div>
  );
};

const ContentRight = () => {
  const { ctx } = useContext(Context);
  const station = ctx.selectedStation;
  const playbackState = usePlaybackState((s) => s.playbackState);
  const setPlaybackState = usePlaybackState((s) => s.setPlaybackState);

  const [descExpanded, setDescExpanded] = useState(false);
  // Two-phase animation states: while opening, overflow stays hidden so a
  // scrollbar can't flash mid-glide on texts that end up fitting; while
  // closing, the text stays unclamped so it doesn't snap, and the ellipsis
  // clamp returns only when the transition ends
  const [descOpening, setDescOpening] = useState(false);
  const [descClosing, setDescClosing] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const descAnimTimer = useRef<number | undefined>(undefined);

  const toggleDesc = () => {
    window.clearTimeout(descAnimTimer.current);
    if (descExpanded && !descClosing) {
      if (descRef.current) descRef.current.scrollTop = 0;
      setDescOpening(false);
      setDescClosing(true);
      descAnimTimer.current = window.setTimeout(() => {
        setDescExpanded(false);
        setDescClosing(false);
      }, 380);
    } else if (!descExpanded) {
      setDescExpanded(true);
      setDescOpening(true);
      descAnimTimer.current = window.setTimeout(() => setDescOpening(false), 380);
    }
  };

  // Collapse the description when switching stations in-page
  useEffect(() => {
    window.clearTimeout(descAnimTimer.current);
    setDescExpanded(false);
    setDescOpening(false);
    setDescClosing(false);
  }, [station?.slug]);

  useEffect(() => () => window.clearTimeout(descAnimTimer.current), []);

  // Only offer "Citește mai mult" when the clamp actually hides text
  useEffect(() => {
    if (descExpanded) return;
    const el = descRef.current;
    if (el) {
      setDescOverflows(el.scrollHeight > el.clientHeight + 2);
    }
  }, [station?.description, descExpanded]);

  // Mobile inline "read more": character count the collapsed text is cut
  // to so that "… Citește mai mult" sits immediately after the last word
  // inside the 3-line cap (null = fits fully / desktop). Measured on a
  // hidden clone with a binary search; a floated link can't do this — it
  // right-aligns and leaves a gap after wherever the text happens to wrap.
  const [descCut, setDescCut] = useState<number | null>(null);
  const [descViewportW, setDescViewportW] = useState(0);
  const [fontsReadyTick, setFontsReadyTick] = useState(0);

  useEffect(() => {
    const onResize = () => setDescViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The cut depends on glyph widths, so recompute once the webfont lands
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontsReadyTick(1);
    });
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (descExpanded) return;
    const el = descRef.current;
    const text = station?.description || "";
    if (!el || !text) return;
    if (!window.matchMedia("(max-width: 768px)").matches) {
      setDescCut(null);
      return;
    }

    const MAX_H = 3 * 20 + 2; // 3 mobile line boxes + rounding slack

    const clone = el.cloneNode(false) as HTMLParagraphElement;
    clone.style.cssText = `position:absolute; visibility:hidden; pointer-events:none; max-height:none; overflow:visible; width:${el.getBoundingClientRect().width}px`;
    const textNode = document.createTextNode(text);
    const link = document.createElement("span");
    link.className = styles.desc_toggle_inline;
    link.textContent = "Citește mai mult";
    clone.append(textNode, link);
    el.parentElement?.appendChild(clone);

    const fits = () => clone.getBoundingClientRect().height <= MAX_H;

    let cut: number | null = null;
    if (!fits()) {
      // Largest prefix that fits together with the inline link
      let lo = 0;
      let hi = text.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        textNode.data = text.slice(0, mid);
        if (fits()) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      // Snap back to a word boundary and drop trailing whitespace
      const head = text.slice(0, lo);
      const lastSpace = head.search(/\s+\S*$/);
      cut = (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(/\s+$/, "").length;
    }
    clone.remove();
    setDescCut(cut);
  }, [station?.description, descExpanded, descViewportW, fontsReadyTick]);

  const descCutApplied = descCut !== null && !descExpanded;

  if (!station) return null;

  const isConnecting =
    playbackState === PLAYBACK_STATE.STARTED || playbackState === PLAYBACK_STATE.BUFFERING;
  const isActive = playbackState !== PLAYBACK_STATE.STOPPED;

  const togglePlay = () => {
    setPlaybackState(isActive ? PLAYBACK_STATE.STOPPED : PLAYBACK_STATE.STARTED);
  };

  const isUp = station.uptime?.is_up !== false;
  const listeners = station.total_listeners || 0;

  return (
    <div className={styles.right_content}>
      <div className={styles.station_details}>
        <div className={styles.status_slot}>
          <p className={styles.status_pill}>
            {isUp ? (
              <>
                <span className={styles.live_dot} />
                <strong>LIVE</strong>
                {listeners > 0 && (
                  <span className={styles.listeners_text}>
                    · <strong>{roPlural(listeners, "persoană", "persoane")}</strong> ascultă
                    împreună cu tine
                  </span>
                )}
              </>
            ) : (
              <>
                <span className={styles.offline_dot} />
                <span className={styles.listeners_text}>Momentan indisponibil</span>
              </>
            )}
          </p>
        </div>

        <div className={styles.title_container}>
          <img
            src={getValidImageUrl(station.thumbnail_url)}
            alt="Radio Crestin"
            height={100}
            width={100}
            fetchPriority="high"
            onError={handleImgError}
          />
          <h1 className={styles.station_title}>{station.title}</h1>
        </div>

        {/* Rating and outbound links merged on one line, separated by a
            hairline rule. noopener without noreferrer — stations get to
            see the referral traffic. */}
        <div className={styles.rating_row}>
          <StationRating
            stationId={station.id}
            stationTitle={station.title}
            stationSlug={station.slug}
            reviewsStats={station.reviews_stats}
          />
          {(station.website || station.facebook_page_id) && (
            <>
              <span className={styles.rating_divider} aria-hidden="true" />
              {station.website && (
                <a
                  className={styles.meta_link}
                  href={withRef(station.website)}
                  target="_blank"
                  rel="noopener"
                >
                  <GlobeIcon />
                  Site
                </a>
              )}
              {station.facebook_page_id && (
                <a
                  className={styles.meta_link}
                  href={withRef(`https://www.facebook.com/${station.facebook_page_id}`)}
                  target="_blank"
                  rel="noopener"
                  title={`${station.title} pe Facebook`}
                >
                  <FacebookIcon />
                  Facebook
                </a>
              )}
            </>
          )}
        </div>

        {station.description && (
          <div className={styles.description_block}>
            <p
              ref={descRef}
              className={`${styles.station_description} ${descExpanded ? styles.desc_expanded : ""} ${descOpening ? styles.desc_opening : ""} ${descClosing ? styles.desc_closing : ""}`}
            >
              {/* Mobile: text pre-cut so the inline link directly follows
                  the last visible word (desktop uses the slot below) */}
              {descCutApplied
                ? station.description.slice(0, descCut!)
                : station.description}
              {descCutApplied && (
                <button
                  className={styles.desc_toggle_inline}
                  onClick={toggleDesc}
                  aria-expanded={false}
                >
                  Citește mai mult
                </button>
              )}
            </p>
            {/* Fixed-height slot: overflow is only measurable after hydration,
                so the toggle fades in without pushing the actions row down */}
            <div className={styles.desc_toggle_slot}>
              {(descOverflows || descExpanded) && (
                <button
                  className={styles.desc_toggle}
                  onClick={toggleDesc}
                  aria-expanded={descExpanded && !descClosing}
                >
                  {descExpanded && !descClosing ? "Afișează mai puțin" : "Citește mai mult"}
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.hero_actions}>
          <button
            className={styles.play_cta}
            onClick={togglePlay}
            aria-label={isActive ? `Oprește ${station.title}` : `Ascultă ${station.title}`}
          >
            {/* Fixed icon slot: every state renders in the same 18px stage so
                label/icon swaps never nudge the layout */}
            <span className={styles.cta_icon} aria-hidden="true">
              {isConnecting ? (
                <span className={styles.play_spinner} />
              ) : isActive ? (
                <>
                  {/* Playing reads as a live equalizer; hover swaps in the
                      pause glyph so the click target stays explicit */}
                  <span className={styles.cta_eq}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.cta_pause_glyph}>
                    <PauseIcon />
                  </span>
                </>
              ) : (
                <PlayIcon />
              )}
            </span>
            {isConnecting ? "Se conectează…" : isActive ? "Pauză" : "Ascultă acum"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const { ctx } = useContext(Context);
  // Only stations with a palette extracted from their logo get the color
  // wash — a neutral tint reads as a stain, so b&w-logo stations keep the
  // clean flat frame instead
  const colors = getStationColors(ctx.selectedStation?.slug);

  return (
    <header className={styles.container}>
      {colors && <StationWash primary={colors.primary} secondary={colors.secondary} />}
      <Navigation />
      <div className={styles.content_section}>
        <ContentLeft />
        <ContentRight />
      </div>
      <div className={styles.share_on_social}>
        <ShareOnSocial />
      </div>
    </header>
  );
};

export default Header;

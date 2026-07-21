"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStationSongHistory } from "@/services/getStations";
import type { ISongHistoryItem } from "@/services/getStations";
import styles from "./styles.module.scss";
import { getValidImageUrl } from "@/utils";

interface SongHistoryProps {
  stationSlug: string;
  stationTitle: string;
  stationThumbnailUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedHistory {
  dateKey: string;
  dateLabel: string;
  hours: {
    hourKey: string;
    hourLabel: string;
    songs: ISongHistoryItem[];
  }[];
}

const HOUR = 3600;
// Hour-aligned windows fetched in parallel per scroll trigger (each request stays CDN-cacheable)
const HOURS_PER_BATCH = 6;
// One trigger scans at most this many silent batches before yielding back to the scroll
const MAX_BATCHES_PER_LOAD = 4;
// The list only ends after this many consecutive hours with no songs
const MAX_EMPTY_HOURS = 72;
// The API keeps a rolling window of history; the date picker stops there
const RETENTION_DAYS = 7;

const pad2 = (n: number) => String(n).padStart(2, "0");

// Local calendar date (YYYY-MM-DD). toISOString() would give the UTC date,
// which disagrees with the local hours shown next to it around midnight.
const toLocalDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatDateLabel = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Azi";
  if (date.toDateString() === yesterday.toDateString()) return "Ieri";

  return date.toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const groupHistoryByDateAndHour = (items: ISongHistoryItem[]): GroupedHistory[] => {
  const groups = new Map<string, Map<string, ISongHistoryItem[]>>();

  for (const item of items) {
    if (!item.song) continue;
    const date = new Date(item.timestamp);
    const dateKey = toLocalDateKey(date);
    const hourKey = `${dateKey}-${pad2(date.getHours())}`;

    if (!groups.has(dateKey)) groups.set(dateKey, new Map());
    const hourMap = groups.get(dateKey)!;
    if (!hourMap.has(hourKey)) hourMap.set(hourKey, []);
    hourMap.get(hourKey)!.push(item);
  }

  const result: GroupedHistory[] = [];
  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  for (const dateKey of sortedDates) {
    const hourMap = groups.get(dateKey)!;
    const sampleDate = new Date(dateKey + "T12:00:00");
    const sortedHours = Array.from(hourMap.keys()).sort((a, b) => b.localeCompare(a));

    const hours = sortedHours.map((hourKey) => {
      const songs = hourMap.get(hourKey)!;
      const hour = new Date(songs[0].timestamp).getHours();
      return {
        hourKey,
        hourLabel: `${String(hour).padStart(2, "0")}:00 - ${String(hour).padStart(2, "0")}:59`,
        songs: songs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      };
    });

    result.push({
      dateKey,
      dateLabel: formatDateLabel(sampleDate),
      hours,
    });
  }

  return result;
};

const dedupeByTimestamp = (items: ISongHistoryItem[]): ISongHistoryItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.timestamp)) return false;
    seen.add(item.timestamp);
    return true;
  });
};

const getYouTubeSearchUrl = (songName: string, artistName?: string): string => {
  const query = artistName ? `${songName} ${artistName}` : songName;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

// Memoized: `grouped` is reference-stable between appends (useMemo below), so
// spinner/scroll-button state flips skip reconciling the row tree entirely.
const HistoryGroups = React.memo<{
  grouped: GroupedHistory[];
  stationThumbnailUrl?: string;
}>(({ grouped, stationThumbnailUrl }) => (
  <>
    {grouped.map((dateGroup) => (
      <div key={dateGroup.dateKey} className={styles.date_group}>
        <div className={styles.date_header}>
          <span>{dateGroup.dateLabel}</span>
        </div>
        {dateGroup.hours.map((hourGroup) => (
          <div key={hourGroup.hourKey} className={styles.hour_group}>
            <div className={styles.hour_header}>{hourGroup.hourLabel}</div>
            {hourGroup.songs.map((item, i) => {
              if (!item.song) return null;
              const time = new Date(item.timestamp);
              const timeStr = time.toLocaleTimeString("ro-RO", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <a
                  key={`${item.song.id}-${item.timestamp}-${i}`}
                  className={styles.song_item}
                  data-timestamp={item.timestamp}
                  href={getYouTubeSearchUrl(
                    item.song.name,
                    item.song.artist?.name || undefined
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Cauta melodia pe YouTube"
                >
                  <span className={styles.song_thumbnail_wrap}>
                    <img
                      className={styles.song_thumbnail}
                      src={getValidImageUrl(item.song.thumbnail_url, getValidImageUrl(stationThumbnailUrl))}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = getValidImageUrl(stationThumbnailUrl);
                      }}
                    />
                    <span className={styles.thumb_overlay} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v13.72L19 12 8 5.14z" />
                      </svg>
                    </span>
                  </span>
                  <span className={styles.song_info}>
                    <span className={styles.song_name}>{item.song.name}</span>
                    {item.song.artist?.name && (
                      <span className={styles.song_artist}>{item.song.artist.name}</span>
                    )}
                  </span>
                  <span className={styles.song_time}>{timeStr}</span>
                </a>
              );
            })}
          </div>
        ))}
      </div>
    ))}
  </>
));

HistoryGroups.displayName = "HistoryGroups";

const SkeletonRow: React.FC<{ seed: number }> = ({ seed }) => (
  <div className={styles.skeleton_item}>
    <div className={styles.skeleton_thumbnail} />
    <div className={styles.skeleton_info}>
      <div className={styles.skeleton_line} style={{ width: `${52 + (seed % 3) * 14}%` }} />
      <div className={styles.skeleton_line_short} style={{ width: `${30 + (seed % 4) * 9}%` }} />
    </div>
    <div className={styles.skeleton_time} />
  </div>
);

// ---------- Date filter modal ----------
const DateFilterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onApply: (date: string, time: string) => void;
  initialDate?: string;
  initialTime?: string;
}> = ({ isOpen, onClose, onApply, initialDate, initialTime }) => {
  const [date, setDate] = useState(initialDate || "");
  const [time, setTime] = useState(initialTime || "");

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate || "");
      setTime(initialTime || "");
    }
  }, [isOpen, initialDate, initialTime]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.filter_overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.filter_modal}>
        <div className={styles.filter_modal_header}>
          <h3 className={styles.filter_modal_title}>Filtreaza dupa data</h3>
          <button className={styles.filter_close} onClick={onClose} aria-label="Inchide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <p className={styles.filter_description}>
          Alege o data si ora pentru a vedea melodiile redate in acel moment.
          Istoricul este disponibil pentru ultimele {RETENTION_DAYS} zile.
        </p>

        <div className={styles.filter_fields}>
          <div className={styles.filter_field}>
            <label className={styles.filter_label}>Data</label>
            <input
              type="date"
              className={styles.filter_input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              min={toLocalDateKey(
                new Date(Date.now() - RETENTION_DAYS * 24 * HOUR * 1000)
              )}
              max={toLocalDateKey(new Date())}
            />
          </div>
          <div className={styles.filter_field}>
            <label className={styles.filter_label}>Ora (optional)</label>
            <input
              type="time"
              className={styles.filter_input}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            />
          </div>
        </div>

        <div className={styles.filter_actions}>
          <button className={styles.filter_cancel_btn} onClick={onClose}>
            Anuleaza
          </button>
          <button
            className={styles.filter_apply_btn}
            onClick={() => onApply(date, time)}
            disabled={!date}
          >
            Aplica filtrul
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ---------- Main component ----------
const SongHistory: React.FC<SongHistoryProps> = ({
  stationSlug,
  stationTitle,
  stationThumbnailUrl,
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<ISongHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Bumped after a fully-empty scan round: nothing was appended, so without it
  // the observer effect would never re-arm and the back-scan would stall
  const [scanTick, setScanTick] = useState(0);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterTime, setFilterTime] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<string | null>(null);

  // Row elements cached per append so the scroll tracker never re-queries the
  // DOM per frame; URL writes are debounced to scroll settle.
  const rowsCacheRef = useRef<HTMLElement[]>([]);
  const urlUpdateTimerRef = useRef<number | null>(null);
  const lastAnchorTsRef = useRef<string | null>(null);

  // Pagination lives in refs so the IntersectionObserver callback never closes
  // over stale state; the generation counter cancels in-flight loads on
  // close / filter changes.
  const cursorRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const hasMoreRef = useRef(true);
  const emptyHoursRef = useRef(0);
  const generationRef = useRef(0);

  const updateUrlTimestamp = useCallback((timestamp: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("t", timestamp);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const loadInitial = useCallback(
    async (targetTs?: number) => {
      const gen = ++generationRef.current;
      busyRef.current = true;
      hasMoreRef.current = true;
      emptyHoursRef.current = 0;
      cursorRef.current = null;
      setIsLoading(true);
      setIsLoadingMore(false);
      setHistory([]);
      setHasMore(true);

      const nowUnix = Math.floor(Date.now() / 1000);
      // Align to the hour ceiling for cache efficiency, capped at current time
      const aligned = Math.min(Math.ceil((targetTs ?? nowUnix) / HOUR) * HOUR, nowUnix);
      // Both bounds must be explicit: given only to_timestamp, the API falls
      // back to from=now and returns an empty head whose from_timestamp points
      // at today — every filtered load would then walk back from now instead
      // of the requested date.
      const head = await getStationSongHistory(stationSlug, aligned - HOUR, aligned);
      if (gen !== generationRef.current) return;

      let items = head?.history ?? [];
      let cursor: number | null = head?.from_timestamp ?? null;

      if (cursor !== null) {
        // Preload a few more hours so the first screen is comfortably filled
        const base = cursor;
        const pages = await Promise.all(
          Array.from({ length: 3 }, (_, i) =>
            getStationSongHistory(stationSlug, base - (i + 1) * HOUR, base - i * HOUR)
          )
        );
        if (gen !== generationRef.current) return;
        items = [...items, ...pages.flatMap((p) => p?.history ?? [])];
        cursor = base - 3 * HOUR;
      }

      cursorRef.current = cursor;
      hasMoreRef.current = cursor !== null;
      busyRef.current = false;
      setHistory(dedupeByTimestamp(items));
      setHasMore(cursor !== null);
      setIsLoading(false);
    },
    [stationSlug]
  );

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMoreRef.current || cursorRef.current === null) return;
    const gen = generationRef.current;
    busyRef.current = true;
    setIsLoadingMore(true);

    let cursor = cursorRef.current;
    let collected: ISongHistoryItem[] = [];
    let batches = 0;

    // Keep scanning past silent hours (talk blocks, overnight gaps) instead of
    // ending the list on the first empty hour.
    while (collected.length === 0 && batches < MAX_BATCHES_PER_LOAD) {
      const base = cursor;
      const pages = await Promise.all(
        Array.from({ length: HOURS_PER_BATCH }, (_, i) =>
          getStationSongHistory(stationSlug, base - (i + 1) * HOUR, base - i * HOUR)
        )
      );
      if (gen !== generationRef.current) return;

      collected = pages.flatMap((p) => p?.history ?? []);
      cursor -= HOURS_PER_BATCH * HOUR;
      batches += 1;
      if (collected.length === 0) emptyHoursRef.current += HOURS_PER_BATCH;
    }

    cursorRef.current = cursor;

    if (collected.length > 0) {
      emptyHoursRef.current = 0;
      setHistory((prev) => dedupeByTimestamp([...prev, ...collected]));
    } else if (emptyHoursRef.current >= MAX_EMPTY_HOURS) {
      hasMoreRef.current = false;
      setHasMore(false);
    } else {
      // Empty round below the give-up limit: re-arm the observer so the scan
      // continues (the still-visible sentinel alone fires no new events)
      setScanTick((t) => t + 1);
    }

    busyRef.current = false;
    setIsLoadingMore(false);
  }, [stationSlug]);

  // Load data when modal opens; reset when it closes
  useEffect(() => {
    if (!isOpen) {
      generationRef.current += 1;
      busyRef.current = false;
      cursorRef.current = null;
      hasMoreRef.current = true;
      emptyHoursRef.current = 0;
      scrollTargetRef.current = null;
      setHistory([]);
      setHasMore(true);
      setIsLoading(false);
      setIsLoadingMore(false);
      setFilterDate("");
      setFilterTime("");
      setShowDateFilter(false);
      setShowScrollTop(false);
      return;
    }

    const url = new URL(window.location.href);
    const tParam = url.searchParams.get("t");
    let targetTs: number | undefined;

    if (tParam) {
      const date = new Date(tParam);
      if (!isNaN(date.getTime())) {
        targetTs = Math.floor(date.getTime() / 1000);
        setFilterDate(toLocalDateKey(date));
        setFilterTime(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
        scrollTargetRef.current = tParam;
      }
    }

    loadInitial(targetTs);
  }, [isOpen, loadInitial]);

  // Refresh the row cache whenever the rendered list changes
  useEffect(() => {
    rowsCacheRef.current = listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-timestamp]"))
      : [];
  }, [isOpen, isLoading, history]);

  // Scroll to the t= position after data loads
  useEffect(() => {
    if (!scrollTargetRef.current || history.length === 0 || !listRef.current) return;
    const target = scrollTargetRef.current;
    scrollTargetRef.current = null;

    requestAnimationFrame(() => {
      if (!listRef.current) return;
      const targetTime = new Date(target).getTime();
      const items = Array.from(listRef.current.querySelectorAll("[data-timestamp]"));
      let closest: Element | null = null;
      let closestDiff = Infinity;

      for (const item of items) {
        const ts = (item as HTMLElement).dataset.timestamp;
        if (!ts) continue;
        const diff = Math.abs(new Date(ts).getTime() - targetTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = item;
        }
      }

      if (!closest) return;
      const row = closest;

      // Align the row flush under the sticky day pill (measured, not
      // hard-coded): any extra offset shows a clipped slice of the
      // preceding row in the strip between the pill and the target.
      const align = (): number => {
        const list = listRef.current;
        if (!list || !row.isConnected) return NaN;
        const band =
          row
            .closest(`.${styles.date_group}`)
            ?.querySelector(`.${styles.date_header}`)
            ?.getBoundingClientRect().height ?? 0;
        const top =
          row.getBoundingClientRect().top -
          list.getBoundingClientRect().top +
          list.scrollTop;
        list.scrollTo({ top: Math.max(0, top - band) });
        return list.scrollTop;
      };

      const appliedTop = align();
      // Until the webfont arrives, rows measure with taller fallback-font
      // metrics; when it lands the content above the target shrinks and the
      // row rides up under the pill. Re-align once fonts settle, unless the
      // user has scrolled away in the meantime.
      if (document.fonts && document.fonts.status !== "loaded") {
        document.fonts.ready.then(() => {
          const list = listRef.current;
          if (list && Math.abs(list.scrollTop - appliedTop) < 2) align();
        });
      }
    });
  }, [history]);

  // Infinite scroll. Recreated after every append (history.length dep): the
  // fresh observe() immediately re-probes intersection, so a short page that
  // leaves the sentinel inside the viewport can't stall the list.
  useEffect(() => {
    if (!isOpen || isLoading || !hasMore) return;
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root, rootMargin: "0px 0px 900px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, isLoading, hasMore, history.length, scanTick, loadMore]);

  const handleFilterApply = (date: string, time: string) => {
    if (!date) return;

    const targetDate = new Date(`${date}T${time || "23:59"}:00`);
    if (isNaN(targetDate.getTime())) return;

    setFilterDate(date);
    setFilterTime(time);
    setShowDateFilter(false);
    loadInitial(Math.floor(targetDate.getTime() / 1000));
    updateUrlTimestamp(targetDate.toISOString());
    listRef.current?.scrollTo({ top: 0 });
  };

  const handleClearFilter = () => {
    setFilterDate("");
    setFilterTime("");
    loadInitial();

    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    window.history.replaceState(null, "", url.toString());
    listRef.current?.scrollTo({ top: 0 });
  };

  // Track scroll position -> toggle scroll-to-top button + update URL.
  // The URL write waits for the scroll to settle: history.replaceState is
  // rate-limited (Safari throws past ~100 calls/30s) and the anchor search,
  // although O(log n), is pointless mid-flick.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const container = listRef.current;
    let rafId: number;

    const findAnchorTimestamp = (): string | null => {
      const rows = rowsCacheRef.current;
      if (rows.length === 0) return null;
      const topEdge = container.getBoundingClientRect().top - 10;
      // Rows are in document order, so their tops are monotonic: binary-search
      // the first row that starts at/below the scrollport top
      let lo = 0;
      let hi = rows.length - 1;
      let found: HTMLElement | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].getBoundingClientRect().top >= topEdge) {
          found = rows[mid];
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      return found?.dataset.timestamp ?? null;
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setShowScrollTop(container.scrollTop > 600);
      });

      if (urlUpdateTimerRef.current !== null) window.clearTimeout(urlUpdateTimerRef.current);
      urlUpdateTimerRef.current = window.setTimeout(() => {
        urlUpdateTimerRef.current = null;
        const ts = findAnchorTimestamp();
        if (ts && ts !== lastAnchorTsRef.current) {
          lastAnchorTsRef.current = ts;
          updateUrlTimestamp(ts);
        }
      }, 250);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
      if (urlUpdateTimerRef.current !== null) {
        window.clearTimeout(urlUpdateTimerRef.current);
        urlUpdateTimerRef.current = null;
      }
    };
  }, [isOpen, updateUrlTimestamp]);

  // Lock body scroll + blur the page content behind the overlay.
  // data-modal-blur drives a plain filter on the page (base.scss) instead of
  // backdrop-filter on the overlay, which Chromium/macOS flashes off on
  // cursor movement. Assumes only one fullscreen modal is open at a time.
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow-y: scroll; position: fixed; width: 100%; top: -${scrollY}px`;
    document.documentElement.setAttribute("data-modal-blur", "1");
    return () => {
      document.body.style.cssText = "";
      document.documentElement.removeAttribute("data-modal-blur");
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !showDateFilter) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDateFilter, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Memoized so appends are the only renders that pay for regrouping, and so
  // HistoryGroups sees a stable reference on unrelated state flips
  const grouped = useMemo(() => groupHistoryByDateAndHour(history), [history]);

  if (!isOpen) return null;

  const isEmpty = !isLoading && !hasMore && history.length === 0;
  // Initial hours were silent and the back-scan is still running
  const isScanning = !isLoading && hasMore && grouped.length === 0;

  return createPortal(
    <>
      <div className={styles.modal_overlay} onClick={handleBackdropClick}>
        <div className={styles.modal_content}>
          <div className={styles.modal_header}>
            <div className={styles.header_top}>
              <h2 className={styles.modal_title}>Melodii redate recent</h2>
              <button className={styles.close_button} onClick={onClose} aria-label="Inchide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.station_identity}>
                <img
                  className={styles.station_avatar}
                  src={getValidImageUrl(stationThumbnailUrl)}
                  alt=""
                  width={30}
                  height={30}
                />
                <p className={styles.station_name}>{stationTitle}</p>
              </div>
              <div className={styles.toolbar_actions}>
                {filterDate && (
                  <button
                    className={styles.active_filter}
                    onClick={handleClearFilter}
                  >
                    {filterDate}{filterTime ? ` ${filterTime}` : ""}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6L18 18" />
                    </svg>
                  </button>
                )}
                <button
                  className={styles.filter_button}
                  onClick={() => setShowDateFilter(true)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Filtreaza
                </button>
              </div>
            </div>
          </div>

          <div className={styles.history_list} ref={listRef}>
            {isLoading ? (
              <div className={styles.skeleton_list}>
                <div className={styles.date_header}>
                  <span className={styles.skeleton_date_pill} />
                </div>
                {[6, 5, 5].map((count, gi) => (
                  <div key={gi} className={styles.hour_group}>
                    <div className={styles.hour_header}>
                      <span className={styles.skeleton_hour_pill} />
                    </div>
                    {Array.from({ length: count }).map((_, i) => (
                      <SkeletonRow key={i} seed={i + gi} />
                    ))}
                  </div>
                ))}
              </div>
            ) : isEmpty ? (
              <div className={styles.empty_state}>
                {filterDate
                  ? "Nicio melodie gasita pentru data selectata."
                  : "Niciun istoric disponibil pentru aceasta statie."}
              </div>
            ) : (
              <>
                <HistoryGroups grouped={grouped} stationThumbnailUrl={stationThumbnailUrl} />

                {hasMore && (
                  <div ref={sentinelRef} className={styles.load_more_trigger}>
                    {(isLoadingMore || isScanning) && (
                      <div className={styles.loading_more}>
                        {[0, 1, 2].map((i) => (
                          <SkeletonRow key={i} seed={i} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!hasMore && history.length > 0 && (
                  <div className={styles.end_marker}>Nu mai sunt melodii de afisat</div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            className={`${styles.scroll_top_button} ${showScrollTop ? styles.scroll_top_visible : ""}`}
            onClick={() => {
              const el = listRef.current;
              if (!el) return;
              // Smooth-scrolling from very deep positions takes seconds; jump instead
              el.scrollTo({ top: 0, behavior: el.scrollTop > 6000 ? "auto" : "smooth" });
            }}
            aria-label="Inapoi la inceput"
            tabIndex={showScrollTop ? 0 : -1}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      <DateFilterModal
        isOpen={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onApply={handleFilterApply}
        initialDate={filterDate}
        initialTime={filterTime}
      />
    </>,
    document.body
  );
};

export default SongHistory;

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStationSongHistory, ISongHistoryItem } from "@/services/getStations";
import styles from "./styles.module.scss";

interface SongHistoryProps {
  stationSlug: string;
  stationTitle: string;
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
    const dateKey = date.toISOString().slice(0, 10);
    const hourKey = `${dateKey}-${String(date.getHours()).padStart(2, "0")}`;

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

const getYouTubeSearchUrl = (songName: string, artistName?: string): string => {
  const query = artistName ? `${songName} ${artistName}` : songName;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

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

        <p className={styles.filter_description}>Alege o data si ora pentru a vedea melodiile redate in acel moment.</p>

        <div className={styles.filter_fields}>
          <div className={styles.filter_field}>
            <label className={styles.filter_label}>Data</label>
            <input
              type="date"
              className={styles.filter_input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className={styles.filter_field}>
            <label className={styles.filter_label}>Ora (optional)</label>
            <input
              type="time"
              className={styles.filter_input}
              value={time}
              onChange={(e) => setTime(e.target.value)}
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
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<ISongHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterTime, setFilterTime] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const updateUrlTimestamp = useCallback((timestamp: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("history_t", timestamp);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const removeUrlTimestamp = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("history_t");
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Read timestamp from URL on open
  useEffect(() => {
    if (!isOpen) return;
    const url = new URL(window.location.href);
    const historyT = url.searchParams.get("history_t");
    if (historyT) {
      const date = new Date(historyT);
      if (!isNaN(date.getTime())) {
        setFilterDate(date.toISOString().slice(0, 10));
        setFilterTime(
          `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
        );
      }
    }
  }, [isOpen]);

  const fetchHistory = useCallback(
    async (toTimestamp?: number) => {
      const data = await getStationSongHistory(stationSlug, undefined, toTimestamp);
      if (!data) return { items: [], fromTs: null };
      return { items: data.history, fromTs: data.from_timestamp };
    },
    [stationSlug]
  );

  // Initial load
  useEffect(() => {
    if (!isOpen || initialLoadDone.current) return;

    const load = async () => {
      setIsLoading(true);

      const url = new URL(window.location.href);
      const historyT = url.searchParams.get("history_t");
      let targetTs: number | undefined;

      if (historyT) {
        const date = new Date(historyT);
        if (!isNaN(date.getTime())) {
          targetTs = Math.floor(date.getTime() / 1000) + 3600;
        }
      }

      const { items, fromTs } = await fetchHistory(targetTs);
      setHistory(items);
      if (fromTs) setOldestTimestamp(fromTs);
      setHasMore(items.length > 0);
      initialLoadDone.current = true;
      setIsLoading(false);
    };

    load();
  }, [isOpen, fetchHistory]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHistory([]);
      setOldestTimestamp(null);
      setHasMore(true);
      setFilterDate("");
      setFilterTime("");
      setShowDateFilter(false);
      initialLoadDone.current = false;
    }
  }, [isOpen]);

  // Infinite scroll
  useEffect(() => {
    if (!isOpen || !sentinelRef.current || !listRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMore();
        }
      },
      { root: listRef.current, threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isOpen, hasMore, isLoadingMore, isLoading, oldestTimestamp]);

  const loadMore = async () => {
    if (!oldestTimestamp || isLoadingMore) return;
    setIsLoadingMore(true);

    const { items, fromTs } = await fetchHistory(oldestTimestamp);
    if (items.length === 0) {
      setHasMore(false);
    } else {
      setHistory((prev) => [...prev, ...items]);
      if (fromTs) setOldestTimestamp(fromTs);
    }

    setIsLoadingMore(false);
  };

  const handleFilterApply = async (date: string, time: string) => {
    if (!date) return;

    const timeStr = time || "23:59";
    const targetDate = new Date(`${date}T${timeStr}:00`);
    if (isNaN(targetDate.getTime())) return;

    setFilterDate(date);
    setFilterTime(time);
    setShowDateFilter(false);
    setIsLoading(true);
    setHistory([]);
    setHasMore(true);
    initialLoadDone.current = false;

    const targetTs = Math.floor(targetDate.getTime() / 1000) + 3600;
    const { items, fromTs } = await fetchHistory(targetTs);
    setHistory(items);
    if (fromTs) setOldestTimestamp(fromTs);
    setHasMore(items.length > 0);
    initialLoadDone.current = true;
    setIsLoading(false);

    updateUrlTimestamp(targetDate.toISOString());

    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  };

  // Track scroll position -> update URL
  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const container = listRef.current;
    let rafId: number;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const items = Array.from(container.querySelectorAll("[data-timestamp]"));
        const containerRect = container.getBoundingClientRect();
        for (let i = 0; i < items.length; i++) {
          const rect = (items[i] as HTMLElement).getBoundingClientRect();
          if (rect.top >= containerRect.top - 10) {
            const ts = (items[i] as HTMLElement).dataset.timestamp;
            if (ts) updateUrlTimestamp(ts);
            break;
          }
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [isOpen, updateUrlTimestamp]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow-y: scroll; position: fixed; width: 100%; top: -${scrollY}px`;
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !showDateFilter) {
        onClose();
        removeUrlTimestamp();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDateFilter, onClose, removeUrlTimestamp]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      removeUrlTimestamp();
    }
  };

  const handleClose = () => {
    onClose();
    removeUrlTimestamp();
  };

  if (!isOpen) return null;

  const grouped = groupHistoryByDateAndHour(history);

  return createPortal(
    <>
      <div className={styles.modal_overlay} onClick={handleBackdropClick}>
        <div className={styles.modal_content}>
          <div className={styles.modal_header}>
            <div className={styles.header_top}>
              <div>
                <h2 className={styles.modal_title}>Melodii redate recent</h2>
                <p className={styles.station_name}>{stationTitle}</p>
              </div>
              <button className={styles.close_button} onClick={handleClose} aria-label="Inchide">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className={styles.toolbar}>
              <button
                className={styles.filter_button}
                onClick={() => setShowDateFilter(true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Filtreaza dupa data
              </button>
            </div>
          </div>

          <div className={styles.history_list} ref={listRef}>
            {isLoading ? (
              <div className={styles.loading}>
                <div className={styles.loading_spinner} />
                <p>Se incarca istoricul...</p>
              </div>
            ) : grouped.length === 0 ? (
              <div className={styles.empty_state}>
                Niciun istoric disponibil pentru aceasta statie.
              </div>
            ) : (
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
                            >
                              <img
                                className={styles.song_thumbnail}
                                src={item.song.thumbnail_url || "/images/radio-white-default.jpg"}
                                alt={item.song.name}
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.src = "/images/radio-white-default.jpg";
                                }}
                              />
                              <div className={styles.song_info}>
                                <div className={styles.song_name}>{item.song.name}</div>
                                {item.song.artist?.name && (
                                  <div className={styles.song_artist}>{item.song.artist.name}</div>
                                )}
                                <div className={styles.song_time}>{timeStr}</div>
                              </div>
                              <div className={styles.song_actions}>
                                <img
                                  src="/icons/youtube.svg"
                                  alt="YouTube"
                                  width={20}
                                  height={20}
                                  className={styles.youtube_icon}
                                />
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}

                <div ref={sentinelRef} className={styles.load_more_trigger}>
                  {isLoadingMore && (
                    <div className={styles.loading}>
                      <div className={styles.loading_spinner} />
                    </div>
                  )}
                  {!hasMore && history.length > 0 && (
                    <div className={styles.empty_state} style={{ minHeight: "auto", padding: "16px 0" }}>
                      Nu mai sunt melodii de afisat.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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

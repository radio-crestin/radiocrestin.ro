"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import type { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import FavouriteStationsSection from "@/components/FavouriteStationsSection";
import StationItem from "@/components/StationItem";
import { Magnify } from "@/icons/Magnify";
import CloseIcon from "@/icons/CloseIcon";
import usePlayCount from "@/store/usePlayCount";
import useFavourite from "@/store/useFavourite";
import SparklesStar from "@/icons/SparklesStar";
import { buildScoreSnapshot, sortByScore } from "@/utils/stationScore";
import type { StationSnapshot } from "@/utils/stationScore";
import { createSearchMatcher } from "@/utils/fuzzySearch";
import { trackSearchPerformed, trackSortChanged } from "@/utils/posthog";

type SortOption = "recommended" | "most_played" | "listeners" | "rating" | "alphabetical";

const SORT_LABELS: Record<SortOption, string> = {
  recommended: "Pentru tine",
  most_played: "Cele mai ascultate de mine",
  listeners: "Cei mai mulți ascultători",
  rating: "Cel mai mare rating",
  alphabetical: "Alfabetic",
};

const STORAGE_KEY = "station-sort-preference";

const SortIcons: Record<SortOption, (props: { size?: number }) => React.ReactElement> = {
  recommended: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" fill="#F59E0B" />
      <circle cx="19" cy="5" r="1.5" fill="#F59E0B" />
    </svg>
  ),
  most_played: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  listeners: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  rating: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  alphabetical: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h7" />
      <path d="M3 12h10" />
      <path d="M3 18h5" />
      <path d="M18 6v12" />
      <path d="M15 18l3 3 3-3" />
    </svg>
  ),
};

function getSavedSort(): SortOption {
  if (typeof window === "undefined") return "recommended";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved in SORT_LABELS) return saved as SortOption;
  return "recommended";
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function getStationOfTheDay(stations: IStation[]): string | null {
  if (stations.length === 0) return null;
  // Byte compare (Array.prototype.sort default), NOT localeCompare — must
  // produce exactly the same order as the pre-paint script in PinStations.astro
  const stableOrder = stations.map((s) => s.slug).sort();
  const dayOfYear = getDayOfYear();
  return stableOrder[dayOfYear % stableOrder.length];
}

type PinnedStamp = { order: string[]; day: string | null; mostPlayed: string[] };

function orderBySlugList(stations: IStation[], order: string[]): IStation[] {
  const idx = new Map(order.map((slug, i) => [slug, i]));
  return [...stations].sort(
    (a, b) => (idx.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (idx.get(b.slug) ?? Number.MAX_SAFE_INTEGER),
  );
}

interface SortResult {
  sorted: IStation[];
  stationOfDaySlug: string | null;
  mostPlayedSlugs: string[];
}

function sortStations(
  stations: IStation[],
  sortBy: SortOption,
  playCounts: Record<string, number>,
  favouriteSlugs: string[],
  liveSnapshot: Record<string, StationSnapshot> | null,
): SortResult {
  const scoreSnapshot = liveSnapshot ?? buildScoreSnapshot(stations);
  const list = [...stations];
  let stationOfDaySlug: string | null = null;
  let mostPlayedSlugs: string[] = [];

  switch (sortBy) {
    case "recommended": {
      // Station of the day — pinned to position 1 (and badged)
      stationOfDaySlug = getStationOfTheDay(stations);

      // Top 3 most-played stations by the user — pinned to positions 2-4
      const placedSlugs = new Set<string>();
      if (stationOfDaySlug) placedSlugs.add(stationOfDaySlug);

      const favouriteSet = new Set(favouriteSlugs);
      const mostPlayed = Object.entries(playCounts)
        .filter(([slug]) => !placedSlugs.has(slug) && !favouriteSet.has(slug))
        .filter(([slug]) => stations.some((s) => s.slug === slug))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([slug]) => slug);

      // Backfill with top-scored non-favourite stations if fewer than 3
      if (mostPlayed.length < 3) {
        const alreadyPlaced = new Set(Array.from(placedSlugs).concat(mostPlayed));
        const topByScore = sortByScore(stations.filter((s) => !alreadyPlaced.has(s.slug) && !favouriteSet.has(s.slug)), scoreSnapshot);
        for (const s of topByScore) {
          if (mostPlayed.length >= 3) break;
          mostPlayed.push(s.slug);
        }
      }

      mostPlayedSlugs = mostPlayed;

      // The SSR'd grid is pre-sorted by build-time score (index.astro /
      // [station_slug]/index.astro). Hold that order until the first live
      // listener fetch locks the score snapshot, then apply the pinned
      // order once — a single controlled reshuffle instead of per-poll churn.
      if (!liveSnapshot) {
        return { sorted: list, stationOfDaySlug, mostPlayedSlugs };
      }

      const allSpecialSlugs = new Set([
        ...(stationOfDaySlug ? [stationOfDaySlug] : []),
        ...mostPlayed,
      ]);
      const remaining = sortByScore(stations.filter((s) => !allSpecialSlugs.has(s.slug)), scoreSnapshot);
      const findStation = (slug: string) => stations.find((s) => s.slug === slug);

      const result: IStation[] = [];
      // Position 1: station of the day
      if (stationOfDaySlug) {
        const s = findStation(stationOfDaySlug);
        if (s) result.push(s);
      }
      // Positions 2-4: most played by the user
      for (const slug of mostPlayed) {
        const s = findStation(slug);
        if (s) result.push(s);
      }
      // Remaining stations sorted by score (50% reviews + 50% listeners)
      result.push(...remaining);

      return { sorted: result, stationOfDaySlug, mostPlayedSlugs };
    }
    case "most_played": {
      const played = list.filter((s) => (playCounts[s.slug] || 0) > 0);
      const notPlayed = list.filter((s) => !playCounts[s.slug]);
      played.sort((a, b) => (playCounts[b.slug] || 0) - (playCounts[a.slug] || 0));
      const sortedNotPlayed = sortByScore(notPlayed, scoreSnapshot);
      return { sorted: [...played, ...sortedNotPlayed], stationOfDaySlug: null, mostPlayedSlugs: [] };
    }
    case "listeners":
      list.sort((a, b) => (scoreSnapshot[b.slug]?.listeners || 0) - (scoreSnapshot[a.slug]?.listeners || 0));
      break;
    case "rating":
      list.sort((a, b) => (scoreSnapshot[b.slug]?.rating || 0) - (scoreSnapshot[a.slug]?.rating || 0));
      break;
    case "alphabetical":
      list.sort((a, b) => a.title.localeCompare(b.title, "ro"));
      break;
  }

  return { sorted: list, stationOfDaySlug: null, mostPlayedSlugs };
}

const ChevronDown = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const Stations = () => {
  const { ctx, setCtx } = useContext(Context);
  // Pre-paint pinning contract (PinStations.astro): an inline script reorders
  // the SSR grid to [day station, top-3 most played, ...build order] before
  // first paint and stamps the result on window.__pinnedStations. That stamp
  // is the permanent "recommended" order — hydration matches the mutated DOM
  // and nothing reshuffles post-paint (the old post-fetch reshuffle was an
  // ~0.13 CLS hit on every visit). No stamp (script skipped/failed) → hold
  // the SSR order for the whole visit instead; still no reshuffle.
  const pinnedRef = useRef<PinnedStamp | null | undefined>(undefined);
  if (pinnedRef.current === undefined) {
    pinnedRef.current = typeof window !== "undefined"
      ? ((window as unknown as { __pinnedStations?: PinnedStamp }).__pinnedStations ?? null)
      : null;
  }
  const [filteredStations, setFilteredStations] = useState<IStation[]>(() => {
    const pinned = pinnedRef.current;
    return pinned?.order?.length
      ? orderBySlugList(ctx.stations || [], pinned.order)
      : (ctx.stations || []);
  });
  const [searchedValue, setSearchedValue] = useState("");
  const [sortBy, setSortByState] = useState<SortOption>("recommended");

  const urlSeededQueryRef = useRef<string | null>(null);

  useEffect(() => {
    setSortByState(getSavedSort());

    // Seed the search from ?q= so the SearchAction advertised in the
    // WebSite JSON-LD (/?q={search_term_string}) actually works.
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      urlSeededQueryRef.current = q.trim();
      setSearchedValue(q);
    }
  }, []);

  const setSortBy = (option: SortOption) => {
    trackSortChanged(option);
    setSortByState(option);
    localStorage.setItem(STORAGE_KEY, option);
  };
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<SortOption | null>(null);
  const [stationOfDaySlug, setStationOfDaySlug] = useState<string | null>(null);
  const [mostPlayedSlugs, setMostPlayedSlugs] = useState<string[]>([]);
  const sortRef = useRef<HTMLDivElement>(null);
  const { playCounts } = usePlayCount();
  const { favouriteItems } = useFavourite();
  const scoreSnapshotRef = useRef<Record<string, StationSnapshot> | null>(null);
  const initialOrderRef = useRef<Map<string, number> | null>(null);

  if (!initialOrderRef.current && ctx.stations?.length) {
    initialOrderRef.current = new Map(ctx.stations.map((s: IStation, i: number) => [s.slug, i]));
  }

  // Capture a score snapshot once stations have real listener data (the
  // initial static props set total_listeners to 0, so we wait for the
  // first client-side API fetch before locking in the snapshot).
  if (!scoreSnapshotRef.current && ctx.stations?.length) {
    const hasListenerData = ctx.stations.some((s: IStation) => (s.total_listeners || 0) > 0);
    if (hasListenerData) {
      scoreSnapshotRef.current = buildScoreSnapshot(ctx.stations);
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applySort = (stations: IStation[]) => {
    const result = sortStations(stations, sortBy, playCounts, favouriteItems, scoreSnapshotRef.current);
    let sorted = result.sorted;
    let daySlug = result.stationOfDaySlug;
    let mpSlugs = result.mostPlayedSlugs;
    if (sortBy === "recommended") {
      const pinned = pinnedRef.current;
      if (pinned?.order?.length) {
        // The pre-paint stamp is the single source of truth: same order the
        // inline script gave the DOM, stable across API refreshes (stations
        // added after the build go to the end).
        sorted = orderBySlugList(stations, pinned.order);
        daySlug = pinned.day;
        mpSlugs = pinned.mostPlayed;
      } else if (initialOrderRef.current) {
        // No stamp — hold the SSR order so nothing reshuffles post-paint
        // (API refreshes deliver stations in their own order, so passthrough
        // isn't enough; re-sort by the captured index).
        const order = initialOrderRef.current;
        sorted = [...stations].sort(
          (a, b) => (order.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.slug) ?? Number.MAX_SAFE_INTEGER),
        );
      }
    }
    setStationOfDaySlug(daySlug);
    setMostPlayedSlugs(mpSlugs);
    setCtx({ sortedStations: sorted });
    return sorted;
  };

  useEffect(() => {
    if (searchedValue) {
      handleSearch();
    } else {
      setFilteredStations(applySort(ctx.stations || []));
    }
  }, [ctx.stations, sortBy]);

  useEffect(() => {
    handleSearch();
  }, [searchedValue]);

  // Track searches once typing settles (1.2s idle) with the final query and
  // its result count — one event per search, not one per keystroke. The ref
  // mirror is read at fire time, after filteredStations has settled.
  const filteredCountRef = useRef(0);
  filteredCountRef.current = filteredStations.length;
  const lastTrackedSearchRef = useRef("");

  useEffect(() => {
    const query = searchedValue.trim();
    if (!query || query === lastTrackedSearchRef.current) return;
    const timer = window.setTimeout(() => {
      lastTrackedSearchRef.current = query;
      trackSearchPerformed(
        query,
        filteredCountRef.current,
        query === urlSeededQueryRef.current ? "url" : "typed",
      );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [searchedValue]);

  const handleSearch = () => {
    const matches = createSearchMatcher(searchedValue);
    const newFilteredStations = (ctx.stations || []).filter(
      (station: IStation) =>
        matches(station.title) ||
        matches(station.now_playing?.song?.name) ||
        matches(station.now_playing?.song?.artist?.name),
    );

    setFilteredStations(applySort(newFilteredStations));
  };

  const handleKeyPress = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.container}>
      {ctx.favouriteStations?.length > 0 && (
        <FavouriteStationsSection stations={ctx.favouriteStations} />
      )}
      <div className={`${styles.search_section}`} data-info={"stations-section"}>
        <div ref={sortRef} className={styles.sort_container}>
          <button
            className={`${styles.sort_button} ${showSortDropdown ? styles.sort_button_open : ""}`}
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            aria-label="Sort stations"
          >
            {SortIcons[sortBy]({ size: 15 })}
            <span>{SORT_LABELS[sortBy]}</span>
            <span className={`${styles.chevron} ${showSortDropdown ? styles.chevron_open : ""}`}>
              <ChevronDown size={12} />
            </span>
          </button>
          <div className={`${styles.sort_dropdown} ${showSortDropdown ? styles.sort_dropdown_open : ""}`}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <button
                key={option}
                className={`${styles.sort_option} ${sortBy === option ? styles.sort_option_active : ""}`}
                onClick={() => {
                  setSortBy(option);
                  setShowSortDropdown(false);
                  setHoveredOption(null);
                }}
                onMouseEnter={() => setHoveredOption(option)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <span className={option === "recommended" ? styles.sort_icon_recommended : styles.sort_icon}>
                  {SortIcons[option]({ size: 15 })}
                </span>
                {SORT_LABELS[option]}
                {sortBy === option && (
                  <span className={styles.check_icon}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
          {showSortDropdown && hoveredOption === "recommended" && (
            <div className={styles.info_popup}>
              <p className={styles.info_title}>Despre sortarea &quot;Pentru tine&quot;</p>
              <ul className={styles.info_list}>
                <li>
                  <span className={styles.info_badge_gold}>
                    <SparklesStar width={12} height={12} />
                  </span>
                  <strong>Stația zilei</strong> — în fiecare zi, o stație nouă apare pe primul loc pentru a fi descoperită.
                </li>
                <li>
                  <span className={styles.info_badge_blue}>
                    <SparklesStar width={12} height={12} />
                  </span>
                  <strong>Preferatele tale</strong> — următoarele 3 locuri sunt ocupate de stațiile pe care le asculți cel mai des.
                </li>
                <li>
                  <strong>Celelalte stații</strong> — sunt ordonate după un scor bazat pe:
                  <ul>
                    <li>recenziile ascultătorilor (50%)</li>
                    <li>numărul de ascultători activi (50%)</li>
                  </ul>
                </li>
              </ul>
            </div>
          )}
        </div>
        <div className={`${styles.search_container}`}>
          <input
            id="station-search"
            name="station-search"
            type="text"
            placeholder="Caută un radio..."
            value={searchedValue}
            onChange={(e) => setSearchedValue(e.target.value)}
            onKeyDown={handleKeyPress}
            aria-label="Search a station"
          />
          {searchedValue ? (
            <CloseIcon
              className={styles.icon}
              width={20}
              height={20}
              onClick={() => setSearchedValue("")}
            />
          ) : (
            <Magnify className={styles.icon} width={20} />
          )}
        </div>
      </div>
      <div className={styles.stations_container}>
        {filteredStations.length === 0 ? (
          <div className={styles.no_results}>
            Nu am găsit niciun rezultat cu denumirea:{" "}
            <strong>{searchedValue}</strong>.
          </div>
        ) : (
          filteredStations.map((station: IStation) => {
            let badgeType: "station_of_day" | "most_played" | undefined;
            if (sortBy === "recommended") {
              if (station.slug === stationOfDaySlug) badgeType = "station_of_day";
              else if (mostPlayedSlugs.includes(station.slug)) badgeType = "most_played";
            }
            return (
              <React.Fragment key={`${station.id}-${station.slug}`}>
                <StationItem station={station} badgeType={badgeType} />
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Stations;

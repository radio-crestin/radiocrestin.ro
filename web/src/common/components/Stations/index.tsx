"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import FavoriteItem from "@/components/FavoriteItem";
import StationItem from "@/components/StationItem";
import { Magnify } from "@/icons/Magnify";
import CloseIcon from "@/icons/CloseIcon";
import usePlayCount from "@/store/usePlayCount";
import useFavourite from "@/store/useFavourite";
import SparklesStar from "@/icons/SparklesStar";

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

function getReviewScore(station: IStation): number {
  const avgRating = station.reviews_stats?.average_rating || 0;
  const numReviews = station.reviews_stats?.number_of_reviews || 0;
  return avgRating * numReviews;
}

interface StationSnapshot {
  score: number;
  listeners: number;
  rating: number;
}

function buildScoreSnapshot(stations: IStation[]): Record<string, StationSnapshot> {
  const maxReview = Math.max(...stations.map(getReviewScore), 1);
  const maxListeners = Math.max(...stations.map((s) => s.total_listeners || 0), 1);
  const snapshot: Record<string, StationSnapshot> = {};
  for (const s of stations) {
    snapshot[s.slug] = {
      score: (getReviewScore(s) / maxReview) * 0.5 + ((s.total_listeners || 0) / maxListeners) * 0.5,
      listeners: s.total_listeners || 0,
      rating: getReviewScore(s),
    };
  }
  return snapshot;
}

function sortByScore(stations: IStation[], scoreSnapshot: Record<string, StationSnapshot>): IStation[] {
  return [...stations].sort((a, b) => (scoreSnapshot[b.slug]?.score || 0) - (scoreSnapshot[a.slug]?.score || 0));
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function getStationOfTheDay(stations: IStation[]): string | null {
  if (stations.length === 0) return null;
  const stableOrder = [...stations].sort((a, b) => a.slug.localeCompare(b.slug));
  const dayOfYear = getDayOfYear();
  return stableOrder[dayOfYear % stableOrder.length].slug;
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
  scoreSnapshot: Record<string, StationSnapshot>,
): SortResult {
  const list = [...stations];
  let stationOfDaySlug: string | null = null;
  let mostPlayedSlugs: string[] = [];

  switch (sortBy) {
    case "recommended": {
      // Position 1: Station of the day
      stationOfDaySlug = getStationOfTheDay(stations);

      // Positions 2-4: Top 3 most-played stations by the user
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

      const allSpecialSlugs = new Set([
        ...(stationOfDaySlug ? [stationOfDaySlug] : []),
        ...mostPlayed,
      ]);
      const remaining = sortByScore(stations.filter((s) => !allSpecialSlugs.has(s.slug)), scoreSnapshot);
      const findStation = (slug: string) => stations.find((s) => s.slug === slug);

      const result: IStation[] = [];

      // Position 1: Station of the day
      if (stationOfDaySlug) {
        const s = findStation(stationOfDaySlug);
        if (s) result.push(s);
      }

      // Positions 2-4: Most played by user
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
  const { ctx } = useContext(Context);
  const [filteredStations, setFilteredStations] = useState<IStation[]>(ctx.stations || []);
  const [searchedValue, setSearchedValue] = useState("");
  const [sortBy, setSortByState] = useState<SortOption>("recommended");

  useEffect(() => {
    setSortByState(getSavedSort());
  }, []);

  const setSortBy = (option: SortOption) => {
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
    const snapshot = scoreSnapshotRef.current || buildScoreSnapshot(stations);
    const result = sortStations(stations, sortBy, playCounts, favouriteItems, snapshot);
    setStationOfDaySlug(result.stationOfDaySlug);
    setMostPlayedSlugs(result.mostPlayedSlugs);
    return result.sorted;
  };

  useEffect(() => {
    if (searchedValue) {
      handleSearch();
    } else {
      setFilteredStations(applySort(ctx.stations || []));
    }
  }, [ctx.stations, sortBy]);

  useEffect(() => {
    if (
      ctx.favouriteStations?.length > 0 &&
      document.getElementsByClassName("apasa_aici_move").length > 0
    ) {
      document.getElementsByClassName("apasa_aici_move")[0].remove();
      let favouriteSection: any = document.querySelectorAll(
        '[data-info="favourite-section"]',
      );
      let scrollPosition = favouriteSection[0].offsetTop - 100;
      window.scrollTo({ top: scrollPosition, behavior: "smooth" });
    }
  }, [ctx.favouriteStations]);

  useEffect(() => {
    handleSearch();
  }, [searchedValue]);

  const handleSearch = () => {
    let newFilteredStations: IStation[] = [];
    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.title.toLowerCase().includes(searchedValue),
      ),
    );

    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.now_playing?.song?.name?.toLowerCase().includes(searchedValue),
      ),
    );

    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.now_playing?.song?.artist?.name
          ?.toLowerCase()
          .includes(searchedValue),
      ),
    );

    newFilteredStations = newFilteredStations.filter(
      (station, index, self) =>
        index ===
        self.findIndex((t) => t.id === station.id && t.slug === station.slug),
    );

    setFilteredStations(applySort(newFilteredStations));
  };

  const handleKeyPress = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  function handleNoStationClicked() {
    let stationItems = document.querySelectorAll(
      '[data-station="station-item"]',
    );

    stationItems[1].scrollIntoView({ behavior: "smooth" });

    if (!document.querySelector(".apasa_aici_move")) {
      let newElement = document.createElement("div");
      newElement.className = "apasa_aici_move";
      newElement.textContent = "Apasa aici";
      stationItems[2].appendChild(newElement);

      setTimeout(() => {
        newElement.remove();
      }, 10000);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.favourite_section} data-info={"favourite-section"}>
        <h2>Stații favorite:</h2>
        {ctx.favouriteStations?.length > 0 ? (
          <div className={styles.stations_container}>
            {ctx.favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <FavoriteItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div
            className={`${styles.stations_container} ${styles.favourite_cont}`}
          >
            <div className={styles.favorite_card}>
              <p>Adaugă prima ta stație la favorite.</p>
              <button
                onClick={() => handleNoStationClicked()}
                aria-label="Add to favourite"
              >
                Adaugă
              </button>
            </div>
          </div>
        )}
      </div>
      <div className={`${styles.search_section}`}>
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
            onChange={(e) => setSearchedValue(e.target.value.toLowerCase())}
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
                <StationItem {...station} badgeType={badgeType} />
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Stations;

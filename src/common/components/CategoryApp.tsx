"use client";

import React, { useContext, useEffect, useRef } from "react";
import { ToastContainer } from "react-toastify";
import { Context, ContextProvider } from "@/context/ContextProvider";
import NoInternetConnection from "@/components/NoInternetConnection";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import StationItem from "@/components/StationItem";
import RadioPlayer from "@/components/RadioPlayer";
import type { IStation } from "@/models/Station";
import { initPostHog } from "@/utils/posthog";
import { stationTitle } from "@/utils/seo";

interface CategoryAppProps {
  /** Full station list — context pool for live metadata refresh and the player. */
  stations: IStation[];
  /** Ordered slugs of the stations shown on this category page. */
  categorySlugs: string[];
  /** Station preselected in the player when the visitor hasn't picked one yet. */
  defaultStationSlug?: string;
}

/** sessionStorage key for the station selected on a category page. */
const SELECTED_STATION_KEY = "category-selected-station";

function CategoryContent({
  categorySlugs,
  defaultStationSlug,
}: {
  categorySlugs: string[];
  defaultStationSlug?: string;
}) {
  const { ctx, setCtx } = useContext(Context);
  // Slug selected automatically (not by the visitor) — used to keep the SEO
  // page title untouched until the visitor actually picks a station.
  const autoSelectedRef = useRef<string | null>(null);

  useUpdateContextMetadata();

  useEffect(() => {
    initPostHog();
  }, []);

  // Restore the station selected before a refresh (the URL stays on the
  // category page, so the selection is carried in sessionStorage), or fall
  // back to the page's default station.
  useEffect(() => {
    const savedSlug = sessionStorage.getItem(SELECTED_STATION_KEY);
    const restoredSlug =
      savedSlug && categorySlugs.includes(savedSlug) ? savedSlug : null;
    const slugToSelect = restoredSlug || defaultStationSlug;
    if (!slugToSelect) return;
    const station = (ctx.stations || []).find(
      (s: IStation) => s.slug === slugToSelect,
    );
    if (station) {
      if (!restoredSlug) {
        autoSelectedRef.current = slugToSelect;
      }
      setCtx({ selectedStation: station });
    }
  }, []);

  useEffect(() => {
    if (ctx.selectedStation?.slug) {
      sessionStorage.setItem(SELECTED_STATION_KEY, ctx.selectedStation.slug);
    }
  }, [ctx.selectedStation?.slug]);

  useEffect(() => {
    if (
      ctx.selectedStation &&
      ctx.selectedStation.slug !== autoSelectedRef.current
    ) {
      document.title = stationTitle(ctx.selectedStation.title);
    }
  }, [ctx.selectedStation?.title]);

  const bySlug = new Map<string, IStation>(
    (ctx.stations || []).map((s: IStation) => [s.slug, s]),
  );
  const categoryStations = categorySlugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is IStation => Boolean(s));

  return (
    <NoInternetConnection>
      <div className="category-stations">
        {categoryStations.map((station) => (
          <StationItem key={`${station.id}-${station.slug}`} {...station} />
        ))}
      </div>
      {ctx.selectedStation && <RadioPlayer />}
      <ToastContainer />
    </NoInternetConnection>
  );
}

export default function CategoryApp({
  stations,
  categorySlugs,
  defaultStationSlug,
}: CategoryAppProps) {
  const categorySet = new Set(categorySlugs);
  const initialState = {
    stations,
    // Media-key "next track" cycles within this category's stations
    sortedStations: stations.filter((s) => categorySet.has(s.slug)),
    selectedStation: null,
    favouriteStations: [],
    // Play in place: selecting a station must not rewrite the URL, so a
    // refresh keeps the user on this category page.
    inPagePlayback: true,
  };

  return (
    <ContextProvider initialState={initialState}>
      <CategoryContent
        categorySlugs={categorySlugs}
        defaultStationSlug={defaultStationSlug}
      />
    </ContextProvider>
  );
}

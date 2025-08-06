"use client";

import React from "react";
import Link from "next/link";
import { IStationExtended } from "@/common/models/Station";
import styles from "./page.module.scss";

interface StatisticsClientProps {
  stations: IStationExtended[];
}

export default function StatisticsClient({ stations }: StatisticsClientProps) {
  // Helper function to format numbers with thousand separators
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ro-RO');
  };

  // Sort stations by total_listeners first, then by radio_crestin_listeners
  const sortedStations = [...stations].sort((a, b) => {
    const aListeners = a.total_listeners || a.radio_crestin_listeners || 0;
    const bListeners = b.total_listeners || b.radio_crestin_listeners || 0;
    return bListeners - aListeners;
  });

  // Calculate total listeners using total_listeners when available
  const totalListeners = sortedStations.reduce((total, station) => {
    const listeners = station.total_listeners || station.radio_crestin_listeners || 0;
    return total + listeners;
  }, 0);

  // Calculate radio-crestin.com specific listeners
  const radioCrestinTotal = sortedStations.reduce(
    (total, station) => total + (station.radio_crestin_listeners || 0),
    0
  );

  return (
    <>
      {sortedStations.map((station) => {
        const totalListeners = station.total_listeners || 0;
        const radioCrestinListeners = station.radio_crestin_listeners || 0;
        const displayListeners = totalListeners || radioCrestinListeners;
        
        return (
          <Link
            href={`/${station.slug}`}
            key={station.id}
            className={styles.station_item}
          >
            <span className={styles.station_name}>{station.title}</span>
            <div className={styles.listeners_info}>
              <span className={styles.listeners_count}>
                {formatNumber(displayListeners)} ascultători
              </span>
              {totalListeners > 0 && radioCrestinListeners > 0 && totalListeners !== radioCrestinListeners && (
                <span className={styles.listeners_detail}>
                  ({formatNumber(radioCrestinListeners)} pe radio-crestin.com)
                </span>
              )}
            </div>
          </Link>
        );
      })}
      <div className={styles.total_listeners}>
        🎧 Total Ascultători: {formatNumber(totalListeners)}
        {totalListeners !== radioCrestinTotal && (
          <div className={styles.total_detail}>
            ({formatNumber(radioCrestinTotal)} pe radio-crestin.com)
          </div>
        )}
      </div>
    </>
  );
}
"use client";

import Link from "next/link";
import React, { useMemo } from "react";

import styles from "./styles.module.scss";
import Rating from "@/common/components/Rating/Rating";
import { getStationRating } from "@/common/utils";
import ShareOnSocial from "@/common/components/ShareOnSocial/ShareOnSocial";
import ThemeToggle from "@/common/components/ThemeToggle/ThemeToggle";
import WhatsAppButton from "@/common/components/WhatsAppButton/WhatsAppButton";
import useStation from "@/common/store/useStation";
import { IStationExtended } from "@/common/models/Station";
import { useStationsData } from "@/common/hooks/useStationsData";
import { useSelectedStation } from "@/common/providers/SelectedStationProvider";

const Navigation = () => (
  <nav className={styles.nav}>
    <div className={styles.internal_links}>
      <Link href={"/"} className={styles.logo}>
        <img
          loading={"lazy"}
          src={"/images/radiocrestin_logo.png"}
          width={40}
          height={40}
          alt={"AppStore Image Radio Crestin"}
        />
        <h1>Radio Creștin</h1>
      </Link>
    </div>
    <div className={styles.right_content}>
      <ThemeToggle />
      <WhatsAppButton />
    </div>
  </nav>
);

interface ContentLeftProps {
  selectedStation: IStationExtended | null;
}

const ContentLeft = ({ selectedStation }: ContentLeftProps) => {
  if (!selectedStation) return null;

  const defaultImage = "/images/radiocrestin_logo.png";
  const stationImage = selectedStation?.thumbnail_url || defaultImage;
  const songImage = selectedStation.now_playing?.song?.thumbnail_url;

  return (
    <div className={styles.left_content}>
      <div className={styles.image_container}>
        <div className={styles.container_img_plus_thumb}>
          <img
            loading={"lazy"}
            src={songImage || stationImage}
            alt={selectedStation.title || "Station"}
            width={230}
            height={230}
            className={styles.main_image}
          />
          {songImage && (
            <img
              loading={"lazy"}
              src={stationImage}
              alt={selectedStation.title || "Station"}
              className={styles.img_thumb}
              width={55}
              height={55}
            />
          )}
        </div>
      </div>
      <div className={styles.station_info}>
        <h2 className={styles.station_title}>
          {selectedStation.now_playing?.song?.name || selectedStation.title || ""}
        </h2>
        <p className={styles.station_artist}>
          {selectedStation.now_playing?.song?.artist?.name || ""}
        </p>
      </div>
    </div>
  );
};

interface ContentRightProps {
  selectedStation: IStationExtended | null;
}

const ContentRight = ({ selectedStation }: ContentRightProps) => {
  const defaultImage = "/images/radiocrestin_logo.png";
  const stationImage = selectedStation?.thumbnail_url || defaultImage;
  const stationTitle = selectedStation?.title || "Radio Creștin";
  const stationDescription = selectedStation?.description || "";
  const totalListeners = selectedStation?.total_listeners || 0;

  return (
    <div className={styles.right_content}>
      <div className={styles.station_details}>
        <div className={styles.title_container}>
          <img
            src={stationImage}
            alt={stationTitle}
            height={100}
            width={100}
          />
          <h1 className={styles.station_title}>{stationTitle}</h1>
        </div>
        <div className={styles.rating_wrapper}>
          <Rating
            score={getStationRating(selectedStation?.reviews || [])}
            starHeight={22}
          />
          <span>({selectedStation?.reviews?.length || 0} recenzii)</span>
        </div>
        {totalListeners !== 0 ? (
          <>
            <p className={styles.nr_listeners_desktop}>
              {totalListeners} persoane ascultă împreună
              cu tine acest radio
            </p>
            <p className={styles.nr_listeners_mobile}>
              {totalListeners} ascultători
            </p>
          </>
        ) : (
          <>
            <p className={styles.nr_listeners_desktop}></p>
            <p className={styles.nr_listeners_mobile}></p>
          </>
        )}
        <p className={styles.station_description}>
          {stationDescription}
        </p>

        <div className={styles.share_on_social}>
          <ShareOnSocial station={selectedStation} />
        </div>
      </div>
    </div>
  );
};

interface HeaderProps {
  selectedStation?: IStationExtended | null;
}

const Header = ({ selectedStation: propSelectedStation = null }: HeaderProps) => {
  const { currentStation } = useStation();
  
  // Try to use context, but handle the case where we're outside the provider
  let contextSelectedStation = null;
  try {
    const context = useSelectedStation();
    contextSelectedStation = context.selectedStation;
  } catch (error) {
    // We're outside the provider, which is fine for the home page
  }
  
  // Use context selectedStation if available, otherwise fall back to prop
  const activeStation = contextSelectedStation || currentStation || propSelectedStation;
  
  return (
    <>
      <header className={styles.container}>
        <Navigation />
        <div className={styles.content_section}>
          <ContentLeft selectedStation={activeStation} />
          <ContentRight selectedStation={activeStation} />
        </div>
      </header>
    </>
  );
};

export default Header;

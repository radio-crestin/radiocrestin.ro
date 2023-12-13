import Link from "next/link";
import React, { useContext } from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import WhatsAppButton from "@/components/WhatsAppButton";
import Rating from "@/components/Rating";

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
    <div className={styles.external_links}>
      <WhatsAppButton />
      <Link
        href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com"
        target={"_blank"}
      >
        <img src="./icons/FigmaIcon.png" alt="Figma icon" />
      </Link>
      <Link href="https://github.com/radio-crestin" target={"_blank"}>
        <img src="./icons/Github.png" alt="Github icon" />
      </Link>
    </div>
  </nav>
);

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  if (!selectedStation) return null;

  return (
    <div className={styles.left_content}>
      {ctx.selectedStation && (
        <>
          <img
            loading={"lazy"}
            src={selectedStation.thumbnail_url}
            alt={selectedStation.title}
            className={styles.station_image}
            width={230}
            height={230}
          />
          <div className={styles.station_info}>
            <h2 className={styles.station_title}>
              {selectedStation.now_playing?.song?.name || selectedStation.title}
            </h2>
            <p className={styles.station_artist}>
              {selectedStation.now_playing?.song?.artist.name}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const ContentRight = () => {
  const { ctx } = useContext(Context);
  const average = (arr: any[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const stationRating =
    Math.round(
      (average(ctx.selectedStation?.reviews?.map((i: any) => i.stars) || []) ||
        0) * 10,
    ) / 10;

  return (
    <div className={styles.right_content}>
      <div className={styles.station_details}>
        <h1 className={styles.station_title}>{ctx.selectedStation?.title}</h1>
        <div className={styles.rating_wrapper}>
          <Rating score={stationRating} starHeight={22} /> (
          {ctx.selectedStation?.reviews?.length || 0} recenzii)
        </div>
        <p className={styles.nr_listeners}>
          {ctx.selectedStation?.total_listeners} persoane ascultă împreună cu
          tine acest radio
        </p>
        <p className={styles.station_description}>
          {ctx.selectedStation?.description}
        </p>
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <header className={styles.container}>
      <Navigation />
      <div className={styles.content_section}>
        <ContentLeft />
        <ContentRight />
      </div>
    </header>
  );
};

export default Header;

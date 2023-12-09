import Link from "next/link";
import styles from "./styles.module.scss";
import React, { useContext } from "react";
import { Context } from "@/context/ContextProvider";

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

const ContentRight = () => {
  const { ctx } = useContext(Context);

  return (
    <div className={styles.right_content}>
      <div className={styles.station_details}>
        <h1 className={styles.station_title}>{ctx.selectedStation.title}</h1>
        <p className={styles.station_description}>
          {ctx.selectedStation.description}
        </p>
      </div>
    </div>
  );
};

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  if (!selectedStation) return null;

  console.log("selectedStation", ctx.selectedStation);

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

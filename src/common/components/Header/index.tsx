import Link from "next/link";
import styles from "./styles.module.scss";
import React, { useContext } from "react";
import { Context } from "@/context/ContextProvider";
import RadioPlayer from "@/components/RadioPlayer";
import useIsElementVisible from "@/hooks/useIsElementVisible";
import { IStation } from "@/models/Station";

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

      {/*TODO: Add it later.*/}
      {/*<Link href={"/despre-noi"}>Despre noi</Link>*/}
      {/*<Link href={"/despre-noi"}>Versetul zilei</Link>*/}
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

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const [stationDetailsRef, isVisibleStationDetails] =
    useIsElementVisible<HTMLDivElement>(20);

  return (
    <div className={styles.station} ref={stationDetailsRef}>
      <div className={styles.station_details}>
        <h1 className={styles.station_title}>{ctx.selectedStation.title}</h1>
        <p className={styles.station_description}>
          {ctx.selectedStation.description}
        </p>
        <div
          className={
            isVisibleStationDetails
              ? styles.player_relative
              : styles.player_fixed
          }
        >
          <RadioPlayer />
        </div>
      </div>
    </div>
  );
};
const ContentRight = () => {
  const { ctx } = useContext(Context);
  return (
    <div className={styles.next_3_stations}>
      {ctx.nextStations.map((station: IStation) => (
        <Link href={station.slug} key={station.slug}>
          <img
            src={station.thumbnail_url}
            alt={station.title}
            height={130}
            width={130}
          />
        </Link>
      ))}
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

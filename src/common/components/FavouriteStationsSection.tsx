import type { IStation } from "@/models/Station";
import FavoriteItem from "@/components/FavoriteItem";
import styles from "@/components/Stations/styles.module.scss";

/**
 * The favourites section markup, shared by the live render (Stations) and the
 * build-time pre-paint template (FavoritesPrepaintSection) so the two can
 * never drift: React 19 hydration adopts the pre-painted DOM only while both
 * render byte-identical output.
 */
const FavouriteStationsSection = ({ stations }: { stations: IStation[] }) => (
  <div className={styles.favourite_section} data-info={"favourite-section"}>
    <h2>Stații favorite:</h2>
    <div className={styles.stations_container}>
      {stations.map((station: IStation) => (
        <FavoriteItem key={`favourite-${station.id}-${station.slug}`} {...station} />
      ))}
    </div>
  </div>
);

export default FavouriteStationsSection;

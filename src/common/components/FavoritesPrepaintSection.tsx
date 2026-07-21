import type { IStation } from "@/models/Station";
import { ContextProvider } from "@/context/ContextProvider";
import FavouriteStationsSection from "@/components/FavouriteStationsSection";

interface Props {
  stations: IStation[];
  selectedStation?: IStation | null;
}

/**
 * Build-time-only render of the favourites section with a card for EVERY
 * station (localStorage is unknown at build). FavoritesPrepaint.astro ships
 * this inside an inert <template>; its inline script keeps only the user's
 * favourites and inserts the section into the island before first paint.
 *
 * Renders the same FavouriteStationsSection the island uses, so the template
 * is byte-identical to what React 19 hydration expects and it adopts the
 * pre-painted DOM. selectedStation must mirror what the page passes to
 * RadioApp, or data-active on the selected station's card would diverge.
 */
const FavoritesPrepaintSection = ({ stations, selectedStation = null }: Props) => (
  <ContextProvider initialState={{ stations, selectedStation, favouriteStations: [] }}>
    <FavouriteStationsSection stations={stations} />
  </ContextProvider>
);

export default FavoritesPrepaintSection;

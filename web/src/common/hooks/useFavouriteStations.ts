import { useContext, useEffect } from "react";
import type { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import useFavourite from "@/store/useFavourite";

const useFavouriteStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const { favouriteItems } = useFavourite();
  useEffect(() => {
    // The closured favouriteItems is unreliable on the first pass: during the
    // hydration render zustand's useSyncExternalStore serves the SERVER
    // snapshot ([]), even though the persisted store already rehydrated. On a
    // pre-painted page (FavoritesPrepaint.astro) flushing that [] unmounts
    // the adopted section for a few ms and blinks the layout (reproduced
    // deterministically on the prod build). Guard on rehydration and read the
    // live store value instead of the closure; the deps still re-run this on
    // toggles and on rehydration itself.
    if (!useFavourite.persist.hasHydrated()) return;
    const currentFavourites = useFavourite.getState().favouriteItems;
    const favouriteStations: Array<IStation | any> =
      currentFavourites
        .map((slug: string) => {
          const foundStation = ctx.stations?.find(
            (station: IStation) => station.slug === slug,
          );
          return foundStation ? foundStation : null;
        })
        .filter((station) => station !== null) || [];
    setCtx({
      favouriteStations: favouriteStations,
    });
  }, [favouriteItems, ctx.stations]);
};

export default useFavouriteStations;

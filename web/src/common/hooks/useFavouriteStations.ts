import { useContext, useEffect } from "react";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import useFavourite from "@/store/useFavourite";

const useFavouriteStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const { favouriteItems } = useFavourite();
  useEffect(() => {
    const favouriteStations: Array<IStation | any> =
      favouriteItems.map((slug: string) => {
        if (!ctx.stations) return [];

        return ctx.stations.find((station: IStation) => station.slug === slug);
      }) || [];
    setCtx({
      favouriteStations: favouriteStations,
      isFavouriteStationsLoaded: true,
    });
  }, [favouriteItems, ctx.stations]);
};

export default useFavouriteStations;

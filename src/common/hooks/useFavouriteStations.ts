import { useContext, useEffect } from "react";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import useStore from "@/store/useStore";

const useFavouriteStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const { favouriteItems } = useStore();
  useEffect(() => {
    const favouriteStations: Array<IStation | any> =
      favouriteItems.map((slug: string) => {
        return ctx.stations.find((station: IStation) => station.slug === slug);
      }) || [];
    setCtx({
      favouriteStations: favouriteStations,
      isFavouriteStationsLoaded: true,
    });
  }, [favouriteItems, ctx.stations]);
};

export default useFavouriteStations;

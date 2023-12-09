import React, { useEffect } from "react";
import { toast } from "react-toastify";

import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import { SEO_404 } from "@/utils/seo";
import Layout from "@/components/Layout";
import { IStation } from "@/models/Station";
import Stations from "@/components/Stations";
import { getStations } from "@/services/getStations";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import HeaderHomepage from "@/components/HeaderHomepage";
import { useRouter } from "next/router";

export default function HomePage() {
  const router = useRouter();
  let path = router.asPath.replace("/", "");
  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    toast.error(
      <div style={{ width: "100%", maxWidth: 500 }}>
        Ne pare rau, dar statia &quot;
        <strong style={{ fontWeight: "bold" }}>{path}</strong>&quot; nu a fost
        gasita.
        <br />
        <br />
        <span style={{ marginTop: 20 }}>
          Vă rugăm să alegeti o alta statie!
        </span>
      </div>,
      {
        position: "top-center",
        autoClose: 9000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      },
    );

    return () => {
      toast.dismiss();
    };
  }, []);

  return (
    <Layout {...SEO_404}>
      <HeaderHomepage />
      <Stations />
    </Layout>
  );
}

export async function getStaticProps(context: any) {
  const { stations } = await getStations();

  // Add is_favorite property to each station
  stations.forEach((station: IStation) => {
    station.is_favorite = false;
  });

  const stations_without_meta = cleanStationsMetadata(stations);
  return {
    props: {
      stations: stations_without_meta,
      favouriteStations: [],
    },
  };
}

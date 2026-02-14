import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { cleanStationsMetadata } from "@/utils";
import { SEO_404 } from "@/utils/seo";
import Layout from "@/components/Layout";
import { IStation } from "@/models/Station";
import Stations from "@/components/Stations";
import { getStations } from "@/services/getStations";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import HeaderHomepage from "@/components/HeaderHomepage";
import Header from "@/components/Header";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import WhatsAppBibleGroup from "@/components/WhatsAppBibleGroup";
import RadioPlayer from "@/components/RadioPlayer";
import { useRouter } from "next/router";
import { Context } from "@/context/ContextProvider";
import { seoStation } from "@/utils/seo";
import FooterLinks from "@/components/FooterLinks";

export default function NotFoundPage() {
  const router = useRouter();
  const { ctx, setCtx } = useContext(Context);
  const [resolvedStation, setResolvedStation] = useState<IStation | null>(null);
  const [checked, setChecked] = useState(false);

  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    if (!router.asPath || checked) return;

    const pathWithoutQuery = router.asPath.split("?")[0].replace(/^\//, "").replace(/\/$/, "");
    const slug = pathWithoutQuery.replace(/\/adauga-recenzie$/, "");

    if (!slug) {
      setChecked(true);
      return;
    }

    const tryResolveStation = async () => {
      // First check if stations are already in context
      let stations = ctx?.stations;
      if (!stations || stations.length === 0) {
        const data = await getStations();
        stations = data?.stations || [];
        if (stations.length > 0) {
          const cleaned = cleanStationsMetadata(
            stations.map((s: IStation) => ({ ...s, is_favorite: false }))
          );
          setCtx({ stations: cleaned });
          stations = cleaned;
        }
      }

      const match = stations?.find((s: IStation) => s.slug === slug);
      if (match) {
        setCtx({ selectedStation: match });
        setResolvedStation(match);
      }
      setChecked(true);
    };

    tryResolveStation();
  }, [router.asPath, ctx?.stations]);

  // Show 404 error toast only for truly unknown pages
  useEffect(() => {
    if (checked && !resolvedStation) {
      const path = router.asPath.replace("/", "");
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
    }
  }, [checked, resolvedStation]);

  // Station found - render station page
  if (resolvedStation) {
    const seo = seoStation(resolvedStation);
    return (
      <Layout {...seo}>
        <Header />
        <WhatsAppBibleGroup />
        <Stations />
        <DownloadAppBanner />
        <FooterLinks />
        {ctx.selectedStation && <RadioPlayer />}
      </Layout>
    );
  }

  // Not yet resolved - show nothing while checking
  if (!checked) {
    return (
      <Layout {...SEO_404}>
        <HeaderHomepage />
        <Stations />
        <FooterLinks />
      </Layout>
    );
  }

  // Truly 404
  return (
    <Layout {...SEO_404}>
      <HeaderHomepage />
      <Stations />
      <FooterLinks />
    </Layout>
  );
}

export async function getStaticProps(context: any) {
  const { stations } = await getStations();

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

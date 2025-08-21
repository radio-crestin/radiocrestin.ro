import React, { useContext } from "react";
import Link from "next/link";

import Layout from "@/components/Layout";
import { SEO_STATISTICI } from "@/utils/seo";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import { Context } from "@/context/ContextProvider";
import { IStation } from "@/models/Station";

export default function StatisticiPage() {
  const { ctx } = useContext(Context);
  useUpdateContextMetadata();
  useFavouriteStations();

  const sortedStations = [...(ctx?.stations || [])].sort(
    (a: IStation, b: IStation) =>
      b.radio_crestin_listeners - a.radio_crestin_listeners,
  );

  const totalListeners = sortedStations.reduce(
    (total: number, station: IStation) =>
      total + station.radio_crestin_listeners,
    0,
  );

  return (
    <Layout {...SEO_STATISTICI}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4">
          <Link href={"/"} className="text-blue-600 hover:underline mb-4">
            <span>←</span> Inapoi
          </Link>
          {sortedStations.map((station: IStation) => (
            <Link href={station.slug} key={station.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
              <span className="font-medium text-gray-900 dark:text-gray-100">{station.title}</span>
              <span className="text-gray-600 dark:text-gray-400">
                {station.radio_crestin_listeners || 0} ascultători
              </span>
            </Link>
          ))}
          <div className="text-center text-xl font-bold mt-8 text-gray-900 dark:text-gray-100">
            🎧 Total Ascultători: {totalListeners}
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            (radio-crestin.com / radiocrestin.ro / Radio Crestin mobile apps)
          </p>
        </div>
      </div>
    </Layout>
  );
}

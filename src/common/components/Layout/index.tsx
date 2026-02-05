import Head from "next/head";
import React, { useContext } from "react";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import MobileAppBanner from "@/components/MobileAppBanner";
import { Context } from "@/context/ContextProvider";

const Layout = ({
  title,
  description,
  keywords,
  imageUrl,
  children,
  fullURL,
  hideAppBanner = false,
}: {
  title: string;
  description: string;
  keywords: string;
  imageUrl: string;
  children: React.ReactNode;
  fullURL: string;
  hideAppBanner?: boolean;
}) => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  return (
    <>
      <AnalyticsScripts />
      <Head>
        {selectedStation &&
          selectedStation.reviews_stats?.number_of_reviews > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "RadioStation",
                  name: `${selectedStation.title} - Radio Crestin`,
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: selectedStation.reviews_stats.average_rating,
                    reviewCount:
                      selectedStation.reviews_stats.number_of_reviews,
                    bestRating: 5,
                    worstRating: 1,
                  },
                }),
              }}
            />
          )}
        <link rel="image_src" href={imageUrl} />

        {/* Metatags */}
        <meta name="keywords" content={keywords} />
        <meta name="title" content={title} />
        <meta name="description" content={description} />
        <meta name="robots" content={"index, follow"} />
        <title>{title}</title>

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:url" content={fullURL} />
        {/* End Twitter */}

        {/* Facebook */}
        <meta property="og:url" content={fullURL} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="Radio Crestin" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ro_RO" />
        {/* End Facebook */}

        {/* Canonical Urls */}
        <link rel="canonical" href={fullURL} />

        <meta name="MobileOptimized" content="width" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {!hideAppBanner && <MobileAppBanner />}
      <main>{children}</main>
    </>
  );
};

export default Layout;

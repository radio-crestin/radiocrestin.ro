import Head from "next/head";
import React, { useContext } from "react";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import MobileAppBanner from "@/components/MobileAppBanner";
import { Context } from "@/context/ContextProvider";
import { SITE_URL } from "@/constants/constants";

const Layout = ({
  title,
  description,
  keywords,
  imageUrl,
  children,
  fullURL,
  hideAppBanner = false,
  noindex = false,
}: {
  title: string;
  description: string;
  keywords: string;
  imageUrl: string;
  children: React.ReactNode;
  fullURL: string;
  hideAppBanner?: boolean;
  noindex?: boolean;
}) => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  return (
    <>
      <AnalyticsScripts />
      <Head>
        {/* Organization + WebSite schema on all pages */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Radio Creștin",
              url: SITE_URL,
              logo: `${SITE_URL}/images/android-chrome-512x512.png`,
              sameAs: [
                "https://github.com/radio-crestin",
                "https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin",
                "https://apps.apple.com/app/6451270471",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Radio Creștin",
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* RadioStation schema for selected station - data is from our own API, safe for JSON-LD */}
        {selectedStation && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "RadioStation",
                name: selectedStation.title,
                url: `${SITE_URL}/${selectedStation.slug}`,
                image: selectedStation.thumbnail_url,
                description: selectedStation.description || `Ascultă ${selectedStation.title} live online pe Radio Creștin`,
                ...(selectedStation.reviews_stats?.number_of_reviews > 0 && {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: selectedStation.reviews_stats.average_rating,
                    reviewCount: selectedStation.reviews_stats.number_of_reviews,
                    bestRating: 5,
                    worstRating: 1,
                  },
                }),
              }),
            }}
          />
        )}
        <link rel="image_src" href={imageUrl} />

        {/* Metatags */}
        <meta name="keywords" content={keywords} />
        <meta name="title" content={title} />
        <meta name="description" content={description} />
        <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
        <title>{selectedStation ? `${selectedStation.title} | Caută şi ascultă Radiouri Creştine online` : title}</title>

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
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
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:site_name" content="Radio Creștin" />
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

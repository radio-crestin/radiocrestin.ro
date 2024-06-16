import Head from "next/head";
import React, { useContext } from "react";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import { Context } from "@/context/ContextProvider";
import { getStationRating } from "@/utils";

const Layout = ({
  title,
  description,
  keywords,
  imageUrl,
  children,
  fullURL
}: {
  title: string;
  description: string;
  keywords: string;
  imageUrl: string;
  children: React.ReactNode;
  fullURL: string;
}) => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  return (
    <>
      <AnalyticsScripts />
      <Head>
        {selectedStation && selectedStation?.reviews.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "http://schema.org",
                "@type": "Product",
                name: `${selectedStation.title} - Radio Crestin`,
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: getStationRating(ctx.selectedStation?.reviews),
                  reviewCount: selectedStation.reviews.length
                }
              })
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
        <meta property="og:url" content={imageUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="Radio Crestin" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={fullURL} />
        {/* End Facebook */}

        {/* Canonical Urls */}
        <link rel="canonical" href={fullURL} />

        <meta name="MobileOptimized" content="width" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta name="apple-itunes-app"
          content={`app-id=6451270471${selectedStation?.slug ? `, app-argument=https://share.radiocrestin.ro/${selectedStation.slug}` : ``}`} />
        <meta name="google-play-app" content="app-id=com.radiocrestin.radio_crestin" />
        <link rel="alternate" href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin" />
      </Head>
      {children}
    </>
  );
};

export default Layout;

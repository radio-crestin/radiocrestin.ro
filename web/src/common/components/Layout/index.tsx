import Head from "next/head";
import React from "react";

import { Box, Container } from "@chakra-ui/react";
import Index from "@/components/AnalyticsScripts";
import DownloadAppBanner from "@/components/DownloadAppBanner/DownloadAppBanner";
import Footer from "@/components/Footer/Footer";

const Layout = ({
  title,
  description,
  keywords,
  imageUrl,
  children,
  fullURL,
}: {
  title: string;
  description: string;
  keywords: string;
  imageUrl: string;
  children: React.ReactNode;
  fullURL: string;
}) => {
  return (
    <>
      <Index />
      <Head>
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
      </Head>
      <Container maxW={"7xl"} mt={"14"}>
        {children}
        <Box mt={20}>
          <DownloadAppBanner />
          <Footer />
        </Box>
      </Container>
    </>
  );
};

export default Layout;

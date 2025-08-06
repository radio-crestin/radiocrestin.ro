import React from "react";
import type { Metadata } from "next";
import { SEO_DEFAULT } from "@/common/utils/seo";
import BugsnagErrorBoundary from "@/common/components/BugsnagErrorBoundary";
import { ThemeProvider } from "next-themes";
import AnalyticsScripts from "@/common/components/AnalyticsScripts/AnalyticsScripts";
import { ToastContainer } from "react-toastify";
import NoInternetConnection from "@/common/components/NoInternetConnection/NoInternetConnection";
import "../../public/styles/_all.scss";
import "react-toastify/dist/ReactToastify.css";

export const metadata: Metadata = {
  title: SEO_DEFAULT.title,
  description: SEO_DEFAULT.description,
  keywords: SEO_DEFAULT.keywords?.split(","),
  authors: [
    {
      name: SEO_DEFAULT.author.name,
      url: SEO_DEFAULT.author.url,
    },
  ],
  openGraph: {
    title: SEO_DEFAULT.title,
    description: SEO_DEFAULT.description,
    url: SEO_DEFAULT.openGraph.url,
    siteName: SEO_DEFAULT.openGraph.site_name,
    images: [
      {
        url: SEO_DEFAULT.openGraph.images[0].url,
        width: SEO_DEFAULT.openGraph.images[0].width,
        height: SEO_DEFAULT.openGraph.images[0].height,
        alt: SEO_DEFAULT.openGraph.images[0].alt,
      },
    ],
    locale: SEO_DEFAULT.openGraph.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_DEFAULT.twitter.title,
    description: SEO_DEFAULT.twitter.description,
    images: SEO_DEFAULT.twitter.images,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SEO_DEFAULT.canonical,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2a2a2a" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes"
        />
      </head>
      <body>
        <BugsnagErrorBoundary>
          <ThemeProvider attribute="data-theme" enableSystem={true} defaultTheme="system" disableTransitionOnChange={true}>
            <NoInternetConnection>
              {children}
              <ToastContainer
                position="bottom-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
              />
            </NoInternetConnection>
          </ThemeProvider>
        </BugsnagErrorBoundary>
        <AnalyticsScripts />
      </body>
    </html>
  );
}

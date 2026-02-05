import "public/styles/_all.scss";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";

import { ContextProvider } from "@/context/ContextProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BugsnagErrorBoundary from "@/components/BugsnagErrorBoundary";
import { ThemeProvider } from "next-themes";
import NoInternetConnection from "@/components/NoInternetConnection";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function MyApp({ Component, pageProps }: AppProps) {
  const initialState = {
    ...pageProps,
  };

  return (
    <BugsnagErrorBoundary>
      <ContextProvider initialState={initialState}>
        <ThemeProvider
          attribute="data-theme"
          enableSystem={true}
          disableTransitionOnChange={true}
        >
          <NoInternetConnection>
            <main className={`${inter.variable} ${inter.className}`}>
              <Component {...pageProps} />
              <ToastContainer />
            </main>
          </NoInternetConnection>
        </ThemeProvider>
      </ContextProvider>
    </BugsnagErrorBoundary>
  );
}

export default MyApp;

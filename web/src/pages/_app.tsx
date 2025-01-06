import "public/styles/_all.scss";
import type { AppProps } from "next/app";

import { ContextProvider } from "@/context/ContextProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BugsnagErrorBoundary from "@/components/BugsnagErrorBoundary";
import { ThemeProvider } from "next-themes";

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
          <Component {...pageProps} />
          <ToastContainer />
        </ThemeProvider>
      </ContextProvider>
    </BugsnagErrorBoundary>
  );
}

export default MyApp;

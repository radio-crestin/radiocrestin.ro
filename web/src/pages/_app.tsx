import "public/styles/_all.scss";
import type { AppProps } from "next/app";

import { ContextProvider } from "@/context/ContextProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BugsnagErrorBoundary from "@/components/BugsnagErrorBoundary";

function MyApp({ Component, pageProps }: AppProps) {
  const initialState = {
    ...pageProps,
  };

  return (
    <BugsnagErrorBoundary>
      <ContextProvider initialState={initialState}>
        <Component {...pageProps} />
        <ToastContainer />
      </ContextProvider>
    </BugsnagErrorBoundary>
  );
}

export default MyApp;

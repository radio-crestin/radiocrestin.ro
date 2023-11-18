import "public/styles/_all.scss";
import type { AppProps } from "next/app";
import { ContextProvider } from "@/context/ContextProvider";

function MyApp({ Component, pageProps }: AppProps) {
  const initialState = {
    ...pageProps,
  };

  return (
    <ContextProvider initialState={initialState}>
      <Component {...pageProps} />
    </ContextProvider>
  );
}

export default MyApp;

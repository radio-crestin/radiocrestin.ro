import { useEffect, useState } from "react";
import { readAppContext, type AppContext } from "./appContext";

/** The app context from the page URL; empty during the static render. */
export function useAppContext(): AppContext {
  const [context, setContext] = useState<AppContext>({});
  useEffect(() => setContext(readAppContext(window.location.search)), []);
  return context;
}

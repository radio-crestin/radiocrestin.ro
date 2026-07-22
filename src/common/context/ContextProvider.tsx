import { createContext, useEffect, useMemo, useReducer, useRef } from "react";

const Context = createContext<any>(null);

function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

// Copy-on-write deep merge: a merge that changes no value returns `obj1`
// itself (recursively — untouched nested objects keep their references).
// The reducer relies on this: the 10s metadata poll re-dispatches
// selectedStation/stations even when nothing changed, and returning the
// same ctx object lets React bail out of the update entirely, so no-op
// polls no longer re-render every consumer, re-run the MediaSession
// effect, or re-sort the grid.
function deepMerge(obj1: any, obj2: any) {
  let output = obj1;
  let changed = false;

  Object.keys(obj2).forEach((key) => {
    const next =
      isObject(obj2[key]) && isObject(obj1[key])
        ? deepMerge(obj1[key], obj2[key])
        : obj2[key];
    if (!Object.is(next, obj1[key])) {
      if (!changed) {
        output = { ...obj1 };
        changed = true;
      }
      output[key] = next;
    }
  });

  return output;
}

const reducer = (ctx: any, newCtx: any) => {
  return deepMerge(ctx, newCtx);
};

const ContextProvider = ({
  children,
  initialState,
}: {
  children: any;
  initialState: any;
}) => {
  const [ctx, setCtx] = useReducer(reducer, initialState);
  const stationsRef = useRef(ctx.stations);

  useEffect(() => {
    stationsRef.current = ctx.stations;
  }, [ctx.stations]);

  useEffect(() => {
    const handlePopState = () => {
      // Paths are pushed with a trailing slash (/station-slug/), so strip
      // slashes on both ends before matching against station slugs.
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
      if (!slug) {
        // Back/forward landed on the homepage entry — deselect so the
        // homepage UI renders again.
        setCtx({ selectedStation: null });
        return;
      }
      if (!stationsRef.current) return;

      const station = stationsRef.current.find(
        (s: any) => s.slug === slug,
      );
      if (station) {
        setCtx({ selectedStation: station });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // setCtx (useReducer dispatch) is identity-stable, so the memo keys on ctx
  // alone — consumers re-render only when the context data actually changed,
  // never because the provider itself re-rendered.
  const value = useMemo(() => ({ ctx, setCtx }), [ctx]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export { Context, ContextProvider };

import { createContext, useEffect, useReducer, useRef } from "react";

const Context = createContext<any>(null);

function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(obj1: any, obj2: any) {
  let output = { ...obj1 };

  Object.keys(obj2).forEach((key) => {
    if (isObject(obj2[key]) && isObject(obj1[key])) {
      output[key] = deepMerge(obj1[key], obj2[key]);
    } else {
      output[key] = obj2[key];
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
      const slug = window.location.pathname.replace(/^\//, "");
      if (!slug || !stationsRef.current) return;

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

  return (
    <Context.Provider value={{ ctx, setCtx }}>{children}</Context.Provider>
  );
};

export { Context, ContextProvider };

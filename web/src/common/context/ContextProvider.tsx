import { createContext, useReducer } from "react";

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

  return (
    <Context.Provider value={{ ctx, setCtx }}>{children}</Context.Provider>
  );
};

export { Context, ContextProvider };

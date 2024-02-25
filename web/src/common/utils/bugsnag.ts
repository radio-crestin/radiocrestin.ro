// utils/bugsnag.ts
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";
import React from "react";

Bugsnag.start({
  apiKey: "637cd2f71acf28bfc92e9bd1207d0233",
  plugins: [new BugsnagPluginReact(React)],
});

export { Bugsnag };

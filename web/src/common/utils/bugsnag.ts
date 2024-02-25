// utils/bugsnag.ts
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";
import React from "react";
import BugsnagPerformance from "@bugsnag/browser-performance";

const BUGSGNAG_API_KEY = "637cd2f71acf28bfc92e9bd1207d0233";

Bugsnag.start({
  apiKey: BUGSGNAG_API_KEY,
  plugins: [new BugsnagPluginReact(React)],
});

BugsnagPerformance.start({ apiKey: BUGSGNAG_API_KEY });

export { Bugsnag };

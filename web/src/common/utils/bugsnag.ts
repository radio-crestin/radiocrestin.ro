// utils/bugsnag.ts
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";
import React from "react";

const BUGSGNAG_API_KEY = "03f4178ca7ab19103c56be345643e42c";

Bugsnag.start({
  apiKey: BUGSGNAG_API_KEY,
  plugins: [new BugsnagPluginReact(React)],
});

export { Bugsnag };

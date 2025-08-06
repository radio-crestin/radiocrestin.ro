// utils/bugsnag.ts
const BUGSGNAG_API_KEY = "03f4178ca7ab19103c56be345643e42c";

// Create a mock Bugsnag object for server-side usage
const mockBugsnag = {
  notify: (error: Error) => {
    console.error('[Bugsnag Mock]', error);
  },
  leaveBreadcrumb: () => {},
  startSession: () => {},
  pauseSession: () => {},
  resumeSession: () => {},
};

// Only initialize Bugsnag on the client side
let Bugsnag: any = mockBugsnag;

if (typeof window !== 'undefined') {
  const BugsnagLib = require('@bugsnag/js');
  const BugsnagPluginReact = require('@bugsnag/plugin-react');
  const React = require('react');
  
  Bugsnag = BugsnagLib.start({
    apiKey: BUGSGNAG_API_KEY,
    plugins: [new BugsnagPluginReact(React)],
  });
}

export { Bugsnag };

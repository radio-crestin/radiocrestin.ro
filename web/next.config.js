const { withPostHogConfig } = require("@posthog/nextjs-config");

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
};

module.exports = withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_API_KEY,
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: "https://eu.posthog.com",
  sourcemaps: {
    enabled: true,
    deleteAfterUpload: true,
  },
});

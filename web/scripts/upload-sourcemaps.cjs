#!/usr/bin/env node
/*
 * Upload Astro client sourcemaps to PostHog so production stack traces
 * de-minify to the original source ("decrypted" frontend code in PostHog).
 *
 * Why this script exists: posthog-cli derives the commit/git info ONLY from
 * CI env vars it recognises (GitHub Actions: GITHUB_*, Vercel: VERCEL_*). On
 * Cloudflare Pages (which exposes CF_PAGES_*) or a plain local build it cannot
 * determine the commit and fails with "Could not determine commit ID", so the
 * upload was silently broken outside GitHub Actions. We normalise the SHA/branch
 * from whatever environment we're in and shim the GITHUB_* vars posthog-cli
 * understands.
 */
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const sha =
  process.env.GITHUB_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  git(["rev-parse", "HEAD"]);

const branch =
  process.env.GITHUB_REF_NAME ||
  process.env.CF_PAGES_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  git(["rev-parse", "--abbrev-ref", "HEAD"]) ||
  "main";

const apiKey = process.env.POSTHOG_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID;

if (!apiKey || !projectId) {
  console.warn(
    "[upload-sourcemaps] POSTHOG_API_KEY/POSTHOG_PROJECT_ID not set — skipping sourcemap upload.",
  );
  process.exit(0);
}
if (!sha) {
  console.warn(
    "[upload-sourcemaps] could not determine a commit SHA — skipping sourcemap upload.",
  );
  process.exit(0);
}

const cli = path.resolve("node_modules/.bin/posthog-cli");
console.log(`[upload-sourcemaps] uploading for radiocrestin.ro@${sha} (branch ${branch})`);

execFileSync(
  cli,
  [
    "--host",
    "https://eu.posthog.com",
    "sourcemap",
    "process",
    "--directory",
    "./dist/_astro",
    "--release-name",
    "radiocrestin.ro",
    "--release-version",
    sha,
    "--skip-release-on-fail",
    "--delete-after",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // Shim the vars posthog-cli understands so commit detection succeeds
      // on Cloudflare Pages / local builds, not just GitHub Actions.
      GITHUB_ACTIONS: "true",
      GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL || "https://github.com",
      GITHUB_REPOSITORY:
        process.env.GITHUB_REPOSITORY || "radio-crestin/radiocrestin.ro",
      GITHUB_REF_NAME: branch,
      GITHUB_SHA: sha,
      POSTHOG_CLI_API_KEY: apiKey,
      POSTHOG_CLI_PROJECT_ID: projectId,
    },
  },
);

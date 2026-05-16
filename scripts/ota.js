// Safe `eas update` wrapper.
//
// Burned twice now (May 2026) by Metro caching `process.env.EXPO_PUBLIC_*`
// inlines from a previous local-env session into "corrective" updates, plus
// the easier mistake of running `eas update` while `.env` still points at
// local Supabase. This script makes both impossible:
//
//   1. Refuses to publish if .env's EXPO_PUBLIC_SUPABASE_URL looks local
//      (localhost / 127.0.0.1 / 0.0.0.0 / non-https).
//   2. Always passes --clear-cache so stale Metro transforms can't sneak
//      old env values into the new bundle.
//
// Usage:
//   npm run ota -- "what changed in this update"
//   npm run ota -- "<message>" --branch <branch>     # override default branch
//
// Default branch is `production`. Pass --branch <name> as additional args
// to target a different branch.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const envPath = path.join(ROOT, ".env");

if (!fs.existsSync(envPath)) {
  console.error(`ERROR: ${envPath} not found. Cannot verify env before OTA.`);
  process.exit(1);
}

const env = fs.readFileSync(envPath, "utf8");
const urlMatch = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m);
const url = urlMatch ? urlMatch[1].trim() : "";

if (!url) {
  console.error("ERROR: .env has no EXPO_PUBLIC_SUPABASE_URL line. Refusing to publish.");
  process.exit(1);
}

if (/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url)) {
  console.error(
    `ERROR: .env points to a local Supabase URL (${url}). Refusing to publish a localhost OTA.\n` +
    `       Restore the cloud .env (e.g. cp ~/.split_bite-backups/cloud.env .env) and re-run.`
  );
  process.exit(1);
}

if (!/^https:\/\//.test(url)) {
  console.error(`ERROR: EXPO_PUBLIC_SUPABASE_URL is not HTTPS (${url}). Refusing to publish.`);
  process.exit(1);
}

// Parse args: first positional is the message, optional --branch <name>.
const args = process.argv.slice(2);
let message = null;
let branch = "production";

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--branch" || a === "-b") {
    branch = args[++i];
  } else if (a === "--message" || a === "-m") {
    message = args[++i];
  } else if (!message && !a.startsWith("-")) {
    message = a;
  }
}

if (!message || !message.trim()) {
  console.error('ERROR: provide an update message — e.g. npm run ota -- "what changed"');
  process.exit(1);
}

console.log(`OK: .env → ${url}`);
console.log(`Publishing OTA to branch "${branch}" with --clear-cache`);
console.log(`Message: ${message}`);
console.log("---");

const result = spawnSync(
  "eas",
  [
    "update",
    "--branch",
    branch,
    "--clear-cache",
    "--non-interactive",
    "--message",
    message,
  ],
  { stdio: "inherit", cwd: ROOT }
);

process.exit(result.status ?? 0);

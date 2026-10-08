#!/usr/bin/env node
// Sends Google/Drive secrets from ~/.config/casamento/.env to Supabase Edge Function secrets
// via stdin (values never appear in argv or terminal output).
import { spawnSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "DRIVE_ROOT_FOLDER_ID", "ALLOWED_ORIGIN"];
const missing = keys.filter((k) => !env[k]);
if (missing.length) { console.error("Faltando:", missing.join(", ")); process.exit(1); }

const body = keys.map((k) => `${k}=${env[k]}`).join("\n") + "\n";
const r = spawnSync("npx", ["--yes", "supabase@2.117.0", "secrets", "set", "--env-file", "/dev/stdin", "--project-ref", "epqqqficeryjsptvyioy"], {
  input: body, stdio: ["pipe", "inherit", "inherit"], env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN },
});
process.exit(r.status ?? 1);

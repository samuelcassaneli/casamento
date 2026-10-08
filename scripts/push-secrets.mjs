#!/usr/bin/env node
// Sends Google/Drive secrets from ~/.config/casamento/.env to Supabase Edge Function secrets
// through the Management API (values never appear in argv or terminal output).
import { loadEnv } from "./env.mjs";

const REF = "epqqqficeryjsptvyioy";
const env = loadEnv();
const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "DRIVE_ROOT_FOLDER_ID", "ALLOWED_ORIGIN"];
const missing = keys.filter((k) => !env[k]);
const token = env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN;
if (missing.length || !token) { console.error("Faltando:", [...missing, ...(token ? [] : ["SUPABASE_ACCESS_TOKEN"])].join(", ")); process.exit(1); }

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(keys.map((name) => ({ name, value: env[name] }))),
});
if (!res.ok) { console.error(`Erro ${res.status}`); process.exit(1); }
console.log("Secrets enviados:", keys.join(", "));

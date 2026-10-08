import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ENV_DIR = join(homedir(), ".config", "casamento");
export const ENV_FILE = join(ENV_DIR, ".env");

export function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, "utf8").split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
}

export function saveEnv(patch) {
  mkdirSync(ENV_DIR, { recursive: true, mode: 0o700 });
  const merged = { ...loadEnv(), ...patch };
  writeFileSync(ENV_FILE, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  chmodSync(ENV_FILE, 0o600);
}

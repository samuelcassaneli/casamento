#!/usr/bin/env node
// One-time: authorizes the couple's Google account, creates the Drive root folder and
// stores GOOGLE_REFRESH_TOKEN + DRIVE_ROOT_FOLDER_ID in ~/.config/casamento/.env (chmod 600).
// Nothing secret is printed to the terminal.
// Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Desktop OAuth client) in that same file.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { loadEnv, saveEnv } from "./env.mjs";

const env = loadEnv();
const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
if (!clientId || !clientSecret) {
  console.error("Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET em ~/.config/casamento/.env");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}/callback`;
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/drive.file",
  access_type: "offline",
  prompt: "consent",
}).toString();

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== "/callback") return res.end();
    const c = url.searchParams.get("code");
    res.end(c ? "Autorizado. Pode fechar esta aba." : "Falhou: " + url.searchParams.get("error"));
    server.close();
    process.stdin.destroy();
    c ? resolve(c) : reject(new Error(url.searchParams.get("error")));
  }).listen(PORT, "127.0.0.1");
  console.log("Abra no navegador (logado na conta Google do casal):\n\n" + authUrl + "\n");
  console.log("Se o navegador estiver em outro computador, a página final vai dar erro de conexão.");
  console.log("Copie o endereço completo dessa página (http://127.0.0.1:53682/callback?code=...) e cole aqui:\n");
  execFile("xdg-open", [authUrl.toString()], () => {});
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    try {
      const c = new URL(line.trim()).searchParams.get("code");
      if (c) { rl.close(); server.close(); resolve(c); }
    } catch { console.log("Endereço inválido, cole a URL inteira."); }
  });
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
});
const tokens = await tokenRes.json();
if (!tokens.refresh_token) {
  console.error("Google não devolveu refresh_token:", tokens.error ?? "desconhecido");
  process.exit(1);
}

let folderId = env.DRIVE_ROOT_FOLDER_ID;
if (!folderId) {
  const f = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Casamento — Fotos dos Convidados", mimeType: "application/vnd.google-apps.folder" }),
  }).then((r) => r.json());
  folderId = f.id;
}

saveEnv({ GOOGLE_REFRESH_TOKEN: tokens.refresh_token, DRIVE_ROOT_FOLDER_ID: folderId });
console.log("OK: refresh token e pasta raiz salvos em ~/.config/casamento/.env");
console.log(`Pasta no Drive: https://drive.google.com/drive/folders/${folderId}`);

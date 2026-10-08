#!/usr/bin/env node
// Usage: node scripts/qr.mjs [event-slug]  →  qr/<slug>.svg + qr/<slug>.png (print quality)
import { mkdirSync } from "node:fs";
import QRCode from "qrcode";

const slug = process.argv[2] ?? "casamento";
const url = `https://samuelcassaneli.github.io/casamento/?e=${encodeURIComponent(slug)}`;
mkdirSync("qr", { recursive: true });
const opts = { errorCorrectionLevel: "H", margin: 2, color: { dark: "#2b2622", light: "#ffffff" } };
await QRCode.toFile(`qr/${slug}.svg`, url, { ...opts, type: "svg" });
await QRCode.toFile(`qr/${slug}.png`, url, { ...opts, width: 2000 });
console.log(`QR para ${url}\n  qr/${slug}.svg\n  qr/${slug}.png`);

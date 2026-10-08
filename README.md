# Fotos do Casamento

Guests scan a QR code, type their name and upload photos/videos straight to the couple's Google Drive.

- `web/` — static front (Vite + TypeScript), deployed to GitHub Pages
- `supabase/` — Postgres schema (RLS) and Edge Functions (`create-upload`, `finalize-upload`, `media-proxy`)
- `scripts/` — Google OAuth setup, secret push, QR generator

Secrets live only in `~/.config/casamento/.env` (local) and Supabase function secrets. Nothing secret is committed.

## Setup
1. `npm install && (cd web && npm install)`
2. Google Cloud: enable Drive API, OAuth consent screen **in production**, Desktop OAuth client. Put `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `~/.config/casamento/.env`.
3. `npm run google:auth` — authorizes the couple's account and creates the Drive folder.
4. Add `ALLOWED_ORIGIN=https://samuelcassaneli.github.io` and `SUPABASE_ACCESS_TOKEN` to the same file.
5. `npx supabase link --project-ref epqqqficeryjsptvyioy && npm run db:push && npm run fn:deploy && npm run secrets:push`
6. Seed event + admins (`supabase/seed.example.sql`).
7. Set repo variable `SUPABASE_ANON_KEY`; push to `main` to deploy.
8. `npm run qr` → `qr/casamento.svg`.

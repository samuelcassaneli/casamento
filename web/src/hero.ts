import { config } from "./config";

type EventInfo = { couple_names: string; wedding_date: string | null };

export async function loadHero(slug: string): Promise<void> {
  let info: EventInfo = { couple_names: config.coupleNames, wedding_date: config.weddingDate || null };
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&select=couple_names,wedding_date`,
      { headers: { apikey: config.supabaseAnonKey } },
    );
    const rows: EventInfo[] = res.ok ? await res.json() : [];
    if (rows[0]) info = rows[0];
  } catch { /* fall back to static config */ }

  document.getElementById("couple")!.textContent = info.couple_names;
  document.title = `${info.couple_names} — Fotos`;
  const date = document.getElementById("date");
  if (date && info.wedding_date) {
    date.textContent = new Date(`${info.wedding_date}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "numeric", month: "long", year: "numeric",
    });
  }
  const tagline = document.getElementById("tagline");
  if (tagline) tagline.textContent = config.tagline;
}

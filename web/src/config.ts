// Edit these with the couple's real data.
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "https://epqqqficeryjsptvyioy.supabase.co",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  defaultEvent: "casamento",
  coupleNames: "Os Noivos",
  weddingDate: "2026-10-17",
  tagline: "Obrigado por fazer parte do nosso dia. Compartilhe com a gente cada momento que você registrou.",
  maxBytes: 500 * 1024 * 1024,
};

export const fn = (name: string) => `${config.supabaseUrl}/functions/v1/${name}`;

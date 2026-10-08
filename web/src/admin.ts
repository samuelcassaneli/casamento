import "./styles.css";
import { createClient, type Session } from "@supabase/supabase-js";
import { config, fn } from "./config";
import { loadHero } from "./hero";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sb = createClient(config.supabaseUrl, config.supabaseAnonKey);

type Upload = {
  id: string; guest_name: string; filename: string; mime: string; size_bytes: number;
  drive_file_id: string; created_at: string;
};

loadHero(new URLSearchParams(location.search).get("e") ?? config.defaultEvent);

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>("email").value.trim();
  const { error } = await sb.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.href.split("#")[0], shouldCreateUser: true },
  });
  $("login-msg").textContent = error ? `Erro: ${error.message}` : "Link enviado. Confira seu email.";
});
$("logout").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_ev, session) => show(session));

let loadedFor: string | null = null;
async function show(session: Session | null) {
  $("login").hidden = !!session;
  $("gallery").hidden = !session;
  if (!session || loadedFor === session.user.id) return;
  loadedFor = session.user.id;
  await loadGallery(session);
}

async function loadGallery(session: Session) {
  const rows: Upload[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("uploads")
      .select("id, guest_name, filename, mime, size_bytes, drive_file_id, created_at")
      .eq("status", "done").order("created_at", { ascending: false }).range(from, from + 999);
    if (error) { $("stats").textContent = `Erro: ${error.message}`; return; }
    rows.push(...(data as Upload[]));
    if (!data || data.length < 1000) break;
  }
  if (rows.length === 0) {
    $("stats").textContent = "Nenhuma foto ainda (ou este email não está autorizado).";
    return;
  }

  const groups = new Map<string, Upload[]>();
  for (const r of rows) {
    const k = r.guest_name.trim();
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const gb = rows.reduce((s, r) => s + r.size_bytes, 0) / 1024 ** 3;
  $("stats").textContent = `${rows.length} arquivos · ${groups.size} convidados · ${gb.toFixed(1)} GB`;

  const container = $("groups");
  container.replaceChildren();
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  for (const [name, items] of sorted) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.dataset.name = name.toLowerCase();
    const h = document.createElement("h2");
    h.textContent = `${name} `;
    const n = document.createElement("small");
    n.textContent = `${items.length}`;
    h.append(n);
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const it of items) grid.append(tile(it, session));
    sec.append(h, grid);
    container.append(sec);
  }
}

const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    observer.unobserve(e.target);
    (e.target as HTMLElement & { load?: () => void }).load?.();
  }
}, { rootMargin: "400px" });

function tile(u: Upload, session: Session): HTMLElement {
  const a = document.createElement("a") as HTMLAnchorElement & { load?: () => void };
  a.className = "tile";
  a.href = `https://drive.google.com/file/d/${u.drive_file_id}/view`;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = u.filename;
  if (u.mime.startsWith("video/")) a.dataset.video = "1";
  a.load = async () => {
    const res = await fetch(`${fn("media-proxy")}?id=${encodeURIComponent(u.drive_file_id)}`, {
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: config.supabaseAnonKey },
    });
    if (!res.ok) { a.classList.add("nothumb"); return; }
    const img = new Image();
    img.alt = u.filename;
    img.src = URL.createObjectURL(await res.blob());
    a.append(img);
  };
  observer.observe(a);
  return a;
}

$<HTMLInputElement>("filter").addEventListener("input", (e) => {
  const q = (e.target as HTMLInputElement).value.toLowerCase().trim();
  for (const g of document.querySelectorAll<HTMLElement>(".group")) {
    g.hidden = !!q && !g.dataset.name!.includes(q);
  }
});

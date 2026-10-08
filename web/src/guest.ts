import "./styles.css";
import { config } from "./config";
import { loadHero } from "./hero";
import { FatalError, mimeOf, uploadFile } from "./upload";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const event = new URLSearchParams(location.search).get("e") ?? config.defaultEvent;
const CONCURRENCY = 2;

type Item = {
  file: File;
  el: HTMLLIElement;
  state: "queued" | "sending" | "done" | "error";
  progress: number;
  error?: string;
};
const items: Item[] = [];
let active = 0;
let wakeLock: any = null;

loadHero(event);

function guest(): string { return localStorage.getItem("guest_name") ?? ""; }

function showStep() {
  const name = guest();
  $("step-name").hidden = !!name;
  $("step-upload").hidden = !name;
  $("guest-label").textContent = name;
  if (!name) $<HTMLInputElement>("guest").focus();
}

$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>("guest").value.replace(/\s+/g, " ").trim();
  if (!name) return;
  localStorage.setItem("guest_name", name);
  showStep();
});
$("change-name").addEventListener("click", () => {
  $<HTMLInputElement>("guest").value = guest();
  localStorage.removeItem("guest_name");
  showStep();
});

$<HTMLInputElement>("files").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  for (const file of Array.from(input.files ?? [])) enqueue(file);
  input.value = "";
  pump();
});

function enqueue(file: File) {
  const el = document.createElement("li");
  el.className = "item";
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  if (mimeOf(file).startsWith("image/") && !/hei[cf]/.test(mimeOf(file))) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    thumb.append(img);
  } else {
    thumb.textContent = mimeOf(file).startsWith("video/") ? "▶" : "◎";
  }
  el.innerHTML = `<div class="meta"><span class="fname"></span><div class="bar"><div></div></div><span class="status"></span></div>`;
  el.prepend(thumb);
  el.querySelector(".fname")!.textContent = file.name;
  $("queue").prepend(el);

  const item: Item = { file, el, state: "queued", progress: 0 };
  if (file.size > config.maxBytes) { item.state = "error"; item.error = "Maior que 500 MB"; }
  else if (!mimeOf(file)) { item.state = "error"; item.error = "Formato não suportado"; }
  items.push(item);
  render(item);
}

function render(item: Item) {
  item.el.dataset.state = item.state;
  (item.el.querySelector(".bar > div") as HTMLElement).style.width = `${Math.round(item.progress * 100)}%`;
  const status = item.el.querySelector(".status")!;
  status.textContent = { queued: "Na fila", sending: `${Math.round(item.progress * 100)}%`, done: "Enviado ✓", error: item.error ?? "Erro" }[item.state];
  if (item.state === "error" && item.error && !item.el.querySelector(".retry") && item.file.size <= config.maxBytes && mimeOf(item.file)) {
    const b = document.createElement("button");
    b.className = "link retry";
    b.textContent = "tentar de novo";
    b.onclick = () => { b.remove(); item.state = "queued"; item.progress = 0; render(item); pump(); };
    status.after(b);
  }
  renderSummary();
}

function renderSummary() {
  const relevant = items.filter((i) => i.file.size <= config.maxBytes);
  const done = items.filter((i) => i.state === "done").length;
  const total = relevant.reduce((s, i) => s + i.file.size, 0) || 1;
  const sent = relevant.reduce((s, i) => s + i.file.size * (i.state === "done" ? 1 : i.progress), 0);
  $("summary").hidden = items.length === 0;
  $("bar-fill").style.width = `${Math.round((sent / total) * 100)}%`;
  const pending = items.filter((i) => i.state === "queued" || i.state === "sending").length;
  $("summary-text").textContent = pending
    ? `Enviando… ${done} de ${items.length}. Mantenha esta tela aberta.`
    : `Você enviou ${done} ${done === 1 ? "arquivo" : "arquivos"}. Obrigado! ♡`;
}

async function pump() {
  while (active < CONCURRENCY) {
    const next = items.find((i) => i.state === "queued");
    if (!next) break;
    active++;
    next.state = "sending";
    render(next);
    holdWake();
    uploadFile(next.file, { event, guest: guest() }, (p) => { next.progress = p; render(next); })
      .then(() => { next.state = "done"; next.progress = 1; })
      .catch((e: unknown) => {
        next.state = "error";
        next.error = e instanceof FatalError ? e.message : "Falha no envio";
      })
      .finally(() => { active--; render(next); pump(); });
  }
  if (active === 0) releaseWake();
}

async function holdWake() {
  if (wakeLock || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await (navigator as any).wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch { /* ignore */ }
}
function releaseWake() { wakeLock?.release(); wakeLock = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && active > 0) holdWake(); });

addEventListener("beforeunload", (e) => {
  if (active > 0) { e.preventDefault(); e.returnValue = ""; }
});

showStep();

import { config, fn } from "./config";

const CHUNK = 8 * 1024 * 1024; // must be a multiple of 256 KiB
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif",
  webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp",
};

export function mimeOf(file: File): string {
  if (file.type) return file.type.toLowerCase();
  return EXT_MIME[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

export function deviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

async function post<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(fn(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FatalError((data as { error?: string }).error ?? `Erro ${res.status}`, res.status < 500);
  return data as T;
}

export class FatalError extends Error {
  constructor(message: string, readonly permanent: boolean) { super(message); }
}

type PutResult = { status: number; range: string | null; body: string };

function put(url: string, blob: Blob | null, contentRange: string, onProgress: (n: number) => void): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", contentRange);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("rede"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Asks Drive how many bytes it already has (used after a network failure). */
async function serverOffset(url: string, size: number): Promise<number | { id: string }> {
  const r = await put(url, null, `bytes */${size}`, () => {});
  if (r.status === 200 || r.status === 201) return { id: JSON.parse(r.body).id };
  if (r.status === 308) return r.range ? Number(r.range.split("-")[1]) + 1 : 0;
  throw new FatalError("Sessão de envio expirou", true);
}

export async function uploadFile(
  file: File,
  ctx: { event: string; guest: string },
  onProgress: (fraction: number) => void,
): Promise<void> {
  const device = deviceId();
  const mime = mimeOf(file);
  const { upload_id, upload_url } = await post<{ upload_id: string; upload_url: string }>("create-upload", {
    event: ctx.event, guest: ctx.guest, device, filename: file.name, mime, size: file.size,
  });

  let offset = 0;
  let attempts = 0;
  let fileId: string | null = null;

  while (fileId === null) {
    const end = Math.min(offset + CHUNK, file.size);
    try {
      const r = await put(upload_url, file.slice(offset, end), `bytes ${offset}-${end - 1}/${file.size}`,
        (n) => onProgress((offset + n) / file.size));
      if (r.status === 200 || r.status === 201) {
        fileId = JSON.parse(r.body).id;
      } else if (r.status === 308) {
        offset = r.range ? Number(r.range.split("-")[1]) + 1 : end;
        attempts = 0;
      } else if (r.status === 404 || r.status === 410) {
        throw new FatalError("Sessão de envio expirou", true);
      } else {
        throw new Error(`HTTP ${r.status}`);
      }
    } catch (e) {
      if (e instanceof FatalError) throw e;
      if (++attempts > 8) throw new FatalError("Sem conexão. Tente de novo mais tarde.", false);
      await sleep(Math.min(30_000, 1000 * 2 ** attempts));
      if (!navigator.onLine) await new Promise((r) => addEventListener("online", r, { once: true }));
      const o = await serverOffset(upload_url, file.size).catch(() => offset);
      if (typeof o === "number") offset = o;
      else fileId = o.id; // finished upstream, response was lost
    }
    onProgress(offset / file.size);
  }

  await post("finalize-upload", { upload_id, device, file_id: fileId });
  onProgress(1);
}

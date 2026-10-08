const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

let cached: { token: string; exp: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await accessToken()}`);
  return fetch(url, { ...init, headers });
}

export async function createFolder(name: string, parent: string): Promise<string> {
  const res = await driveFetch(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parent], mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw new Error(`drive createFolder ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

export async function deleteFile(id: string): Promise<void> {
  await driveFetch(`${DRIVE}/files/${id}`, { method: "DELETE" });
}

/** Starts a resumable session. Passing Origin makes the returned URL usable from that browser origin (CORS). */
export async function startResumable(opts: {
  name: string;
  parent: string;
  mime: string;
  size: number;
  origin: string;
  description?: string;
}): Promise<string> {
  const res = await driveFetch(`${UPLOAD}/files?uploadType=resumable&fields=id,size`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mime,
      "X-Upload-Content-Length": String(opts.size),
      "Origin": opts.origin,
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.parent], description: opts.description }),
  });
  const location = res.headers.get("location");
  if (!res.ok || !location) throw new Error(`drive resumable ${res.status}: ${await res.text()}`);
  return location;
}

export async function fileMeta(id: string): Promise<{ id: string; size?: string; parents?: string[]; thumbnailLink?: string } | null> {
  const res = await driveFetch(`${DRIVE}/files/${id}?fields=id,size,parents,thumbnailLink`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`drive meta ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchAuthed(url: string): Promise<Response> {
  return driveFetch(url);
}

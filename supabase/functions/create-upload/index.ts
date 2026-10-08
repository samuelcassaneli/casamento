import { admin } from "../_shared/db.ts";
import { createFolder, deleteFile, startResumable } from "../_shared/google.ts";
import { json, originOf, preflight } from "../_shared/http.ts";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_PER_DEVICE_DAY = 300;
const MIME_OK = /^(image\/(jpeg|png|heic|heif|webp|gif)|video\/(mp4|quicktime|webm|3gpp))$/;

function cleanName(s: string): string {
  return s.normalize("NFC").replace(/[\u0000-\u001f\/\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
function guestKey(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

async function guestFolder(eventId: string, root: string, guest: string): Promise<string> {
  const key = guestKey(guest);
  const { data: hit } = await admin.from("guest_folders").select("drive_folder_id")
    .eq("event_id", eventId).eq("guest_key", key).maybeSingle();
  if (hit) return hit.drive_folder_id;

  const created = await createFolder(guest, root);
  const { error } = await admin.from("guest_folders")
    .insert({ event_id: eventId, guest_key: key, drive_folder_id: created });
  if (!error) return created;
  // Lost a race with a parallel request: use the winner's folder, drop ours.
  await deleteFile(created).catch(() => {});
  const { data: winner } = await admin.from("guest_folders").select("drive_folder_id")
    .eq("event_id", eventId).eq("guest_key", key).single();
  return winner!.drive_folder_id;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  const origin = originOf(req);
  if (!origin) return json(req, { error: "origin" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: "json" }, 400); }

  const slug = String(body.event ?? "");
  const guest = cleanName(String(body.guest ?? ""));
  const device = String(body.device ?? "");
  const filename = cleanName(String(body.filename ?? "arquivo")) || "arquivo";
  const mime = String(body.mime ?? "").toLowerCase();
  const size = Number(body.size);

  if (!guest) return json(req, { error: "Informe seu nome" }, 400);
  if (!/^[\w-]{8,64}$/.test(device)) return json(req, { error: "device" }, 400);
  if (!MIME_OK.test(mime)) return json(req, { error: "Tipo de arquivo não suportado" }, 415);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return json(req, { error: "Arquivo maior que 500MB" }, 413);
  }

  const { data: event } = await admin.from("events")
    .select("id, active, upload_deadline, drive_folder_id").eq("slug", slug).maybeSingle();
  if (!event || !event.active) return json(req, { error: "Evento não encontrado" }, 404);
  if (event.upload_deadline && new Date(event.upload_deadline) < new Date()) {
    return json(req, { error: "Envio de fotos encerrado" }, 410);
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from("uploads").select("id", { count: "exact", head: true })
    .eq("device_id", device).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_DEVICE_DAY) return json(req, { error: "Limite diário atingido" }, 429);

  try {
    const root = event.drive_folder_id ?? Deno.env.get("DRIVE_ROOT_FOLDER_ID")!;
    const folder = await guestFolder(event.id, root, guest);
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const uploadUrl = await startResumable({
      name: `${stamp}_${filename}`, parent: folder, mime, size, origin,
      description: `Enviado por ${guest}`,
    });
    const { data: row, error } = await admin.from("uploads").insert({
      event_id: event.id, guest_name: guest, device_id: device, filename, mime, size_bytes: size,
    }).select("id").single();
    if (error) throw error;
    return json(req, { upload_id: row.id, upload_url: uploadUrl });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Falha ao preparar envio, tente de novo" }, 502);
  }
});

import { admin } from "../_shared/db.ts";
import { fileMeta } from "../_shared/google.ts";
import { json, originOf, preflight } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST" || !originOf(req)) return json(req, { error: "forbidden" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: "json" }, 400); }
  const uploadId = String(body.upload_id ?? "");
  const device = String(body.device ?? "");
  const fileId = String(body.file_id ?? "");
  const failed = body.failed === true;

  const { data: row } = await admin.from("uploads").select("id, size_bytes, status")
    .eq("id", uploadId).eq("device_id", device).maybeSingle();
  if (!row) return json(req, { error: "not found" }, 404);
  if (row.status === "done") return json(req, { ok: true });

  if (failed) {
    await admin.from("uploads").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", row.id);
    return json(req, { ok: true });
  }

  if (!/^[\w-]{10,}$/.test(fileId)) return json(req, { error: "file_id" }, 400);
  const meta = await fileMeta(fileId).catch(() => null);
  if (!meta || Number(meta.size) !== Number(row.size_bytes)) {
    return json(req, { error: "Arquivo não confirmado no Drive" }, 409);
  }
  await admin.from("uploads").update({
    status: "done", drive_file_id: fileId, finished_at: new Date().toISOString(),
  }).eq("id", row.id);
  return json(req, { ok: true });
});

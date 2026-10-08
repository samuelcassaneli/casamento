import { admin } from "../_shared/db.ts";
import { fetchAuthed, fileMeta } from "../_shared/google.ts";
import { cors, json, preflight } from "../_shared/http.ts";

// Admin-only: returns a thumbnail image for a Drive file the app created.
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  const email = user?.email?.toLowerCase();
  if (!email) return json(req, { error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
  if (!isAdmin) return json(req, { error: "forbidden" }, 403);

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const { data: row } = await admin.from("uploads").select("id").eq("drive_file_id", id).maybeSingle();
  if (!row) return json(req, { error: "not found" }, 404);

  const meta = await fileMeta(id);
  if (!meta?.thumbnailLink) return json(req, { error: "no thumbnail yet" }, 404);
  const img = await fetchAuthed(meta.thumbnailLink.replace(/=s\d+$/, "=s600"));
  if (!img.ok) return json(req, { error: "thumb" }, 502);
  return new Response(img.body, {
    headers: { ...cors(req), "Content-Type": img.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
});

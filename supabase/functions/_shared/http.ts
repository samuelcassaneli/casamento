const allowed = (Deno.env.get("ALLOWED_ORIGIN") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function originOf(req: Request): string | null {
  const o = req.headers.get("origin");
  if (!o) return null;
  if (allowed.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
  return null;
}

export function cors(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": originOf(req) ?? allowed[0] ?? "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: cors(req) }) : null;
}

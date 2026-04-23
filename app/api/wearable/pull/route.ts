import { pull } from "@/lib/wearable/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("s");
  if (!token) return Response.json({ ok: false, reason: "token" }, { status: 400 });
  const snapshot = pull(token);
  if (!snapshot) return Response.json({ ok: false }, { status: 200 });
  return Response.json(
    { ok: true, snapshot },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

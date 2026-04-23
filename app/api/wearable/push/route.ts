import { push } from "@/lib/wearable/relay";
import { logSafe } from "@/lib/privacy/policy";
import type { WearableSnapshot } from "@/lib/wearable/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token: string; snapshot: WearableSnapshot };

export async function POST(req: Request): Promise<Response> {
  try {
    const { token, snapshot } = (await req.json()) as Body;
    if (!token || typeof token !== "string" || token.length < 16) {
      return Response.json({ ok: false, reason: "token" }, { status: 400 });
    }
    if (!snapshot || !Array.isArray(snapshot.days)) {
      return Response.json({ ok: false, reason: "snapshot" }, { status: 400 });
    }
    push(token, snapshot);
    return Response.json({ ok: true });
  } catch (err) {
    logSafe("[wearable.push] bad request", err);
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
}

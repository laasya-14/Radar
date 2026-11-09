import { NextResponse } from "next/server";
import { setAuthorOverride } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: unknown; override?: unknown } | null;
  if (!body || typeof body.key !== "string") return NextResponse.json({ error: "key required" }, { status: 400 });
  const o = body.override;
  if (o !== "trust" && o !== "block" && o !== null) {
    return NextResponse.json({ error: "override must be 'trust', 'block' or null" }, { status: 400 });
  }
  setAuthorOverride(body.key, o);
  return NextResponse.json({ ok: true });
}

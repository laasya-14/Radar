import { NextResponse } from "next/server";
import { startJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = startJob("learn");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true, log: res.run.log });
}

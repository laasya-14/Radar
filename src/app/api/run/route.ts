import { NextResponse } from "next/server";
import { startJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

// Kept for compatibility; the Run panel uses /api/jobs.
export async function POST() {
  const res = startJob("pipeline");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true, log: res.run.log });
}

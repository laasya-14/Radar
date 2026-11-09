import { NextResponse } from "next/server";
import { activeRun, recentRuns, startJob, logTail, isJobKind, JOBS } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Status for the Run panel: what's running, its log tail, and recent runs. */
export async function GET() {
  const active = activeRun();
  const recent = recentRuns();
  return NextResponse.json({
    jobs: Object.entries(JOBS).map(([kind, j]) => ({ kind, label: j.label, desc: j.desc })),
    active,
    log: logTail(active ?? recent[0] ?? null),
    recent,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  if (!isJobKind(body.kind)) return NextResponse.json({ error: "Unknown job." }, { status: 400 });
  const res = startJob(body.kind);
  if (!res.ok) return NextResponse.json({ error: res.error, active: res.run }, { status: 409 });
  return NextResponse.json({ ok: true, active: res.run });
}

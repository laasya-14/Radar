import { NextResponse } from "next/server";
import { TOPICS, type Level } from "@config/topics";
import { LEVELS, setTopicLevel } from "@/lib/levels";
import { rank } from "@/pipeline/rank";

export const dynamic = "force-dynamic";

/** Set your level for one topic, then re-rank right away so the feed reflects it. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { topic?: string; level?: string };
  if (!TOPICS.some((t) => t.id === body.topic) || !LEVELS.some((l) => l.id === body.level)) {
    return NextResponse.json({ error: "Unknown topic or level." }, { status: 400 });
  }
  setTopicLevel(body.topic!, body.level as Level);
  rank();
  return NextResponse.json({ ok: true });
}

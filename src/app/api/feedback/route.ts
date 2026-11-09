import { NextResponse } from "next/server";
import { recordFeedback, FEEDBACK_ACTIONS, type FeedbackAction } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { itemId?: string; action?: string; reasons?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { itemId, action } = body;
  if (!itemId || !action || !FEEDBACK_ACTIONS.includes(action as FeedbackAction)) {
    return NextResponse.json({ error: "itemId and a valid action are required" }, { status: 400 });
  }
  const reasons = Array.isArray(body.reasons) ? body.reasons.filter((r): r is string => typeof r === "string") : null;
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;
  try {
    const state = recordFeedback(itemId, action as FeedbackAction, reasons, note);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

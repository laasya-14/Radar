import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { setLearnedPrefs } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PROFILE = path.join(process.cwd(), "config", "profile.md");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { profile?: unknown; learned?: unknown } | null;
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });
  if (typeof body.profile === "string") {
    if (body.profile.trim().length === 0) {
      return NextResponse.json({ error: "Profile can't be empty." }, { status: 400 });
    }
    await fs.writeFile(PROFILE, body.profile.endsWith("\n") ? body.profile : body.profile + "\n", "utf8");
  }
  if (typeof body.learned === "string") setLearnedPrefs(body.learned);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// Keys the UI may set. Values are written to .env.local, which every pipeline run loads.
const ALLOWED = ["TWITTERAPI_IO_KEY", "GITHUB_TOKEN"] as const;
type Key = (typeof ALLOWED)[number];
const ENV_PATH = () => path.join(process.cwd(), ".env.local");

function readEnv(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(ENV_PATH(), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

/** Which keys are set (never the values themselves). */
export async function GET() {
  const env = readEnv();
  return NextResponse.json(
    Object.fromEntries(ALLOWED.map((k) => [k, env[k] ? { set: true, hint: `…${env[k].slice(-4)}` } : { set: false }]))
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Record<Key, string>>;
  const env = readEnv();
  for (const k of ALLOWED) {
    if (typeof body[k] !== "string") continue;
    const v = body[k]!.trim();
    if (/[\s"'\n]/.test(v)) return NextResponse.json({ error: `${k} has invalid characters.` }, { status: 400 });
    if (v) env[k] = v;
    else delete env[k];
  }
  const text = Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(ENV_PATH(), text, { mode: 0o600 });
  return NextResponse.json({ ok: true });
}

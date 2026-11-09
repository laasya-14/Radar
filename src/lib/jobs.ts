import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { db, now } from "./db";

/** Everything the UI can start. Only these scripts can ever be spawned from the web. */
export const JOBS = {
  pipeline: { script: "pipeline", label: "Find new things", desc: "Check every source for new posts and papers, and pick out the good ones. About 5–15 min." },
  digest: { script: "digest", label: "Make a new digest", desc: "Put your best unread picks into a new list now. About 1 min." },
  library: { script: "library", label: "Update the library", desc: "Look again for the all-time best posts in your topics. About 3–10 min." },
  learn: { script: "learn", label: "Learn from my ratings", desc: "Update what Radar knows about your taste from your likes, dislikes and notes. About 1 min." },
} as const;

export type JobKind = keyof typeof JOBS;
export const isJobKind = (k: unknown): k is JobKind => typeof k === "string" && k in JOBS;

export type RunInfo = {
  id: number;
  kind: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  stats: string | null;
  log: string | null;
  pid: number | null;
};

function alive(pid: number | null): boolean {
  if (!pid) return true; // started outside the UI (scheduler/CLI): trust finished_at
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The run in progress, if any. Runs whose process died without finishing are marked failed. */
export function activeRun(): RunInfo | null {
  const rows = db()
    .prepare("SELECT * FROM runs WHERE finished_at IS NULL AND started_at > datetime('now', '-3 hours') ORDER BY id DESC")
    .all() as RunInfo[];
  for (const r of rows) {
    if (alive(r.pid)) return { ...r };
    db().prepare("UPDATE runs SET finished_at = ?, error = COALESCE(error, 'process exited unexpectedly — see log') WHERE id = ?").run(now(), r.id);
  }
  return null;
}

export function recentRuns(limit = 8): RunInfo[] {
  return (db().prepare("SELECT * FROM runs ORDER BY id DESC LIMIT ?").all(limit) as RunInfo[]).map((r) => ({ ...r }));
}

export function startJob(kind: JobKind): { ok: true; run: RunInfo } | { ok: false; error: string; run?: RunInfo } {
  const busy = activeRun();
  if (busy) return { ok: false, error: `“${JOBS[busy.kind as JobKind]?.label ?? busy.kind}” is already running.`, run: busy };

  const logDir = path.join(process.cwd(), "data", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  const d = db();
  const id = Number(d.prepare("INSERT INTO runs(kind, started_at, log) VALUES(?,?,?)").run(kind, now(), path.relative(process.cwd(), logFile)).lastInsertRowid);

  const fd = fs.openSync(logFile, "a");
  const child = spawn("npm", ["run", JOBS[kind].script], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, RADAR_RUN_ID: String(id) },
  });
  child.unref();
  fs.closeSync(fd);
  d.prepare("UPDATE runs SET pid = ? WHERE id = ?").run(child.pid ?? null, id);
  return { ok: true, run: d.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunInfo };
}

/** Last lines of a run's log, minus npm noise. */
export function logTail(run: RunInfo | null, lines = 30): string[] {
  if (!run?.log) return [];
  try {
    const text = fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), run.log), "utf8");
    return text
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith(">") && !l.startsWith("npm "))
      .slice(-lines);
  } catch {
    return [];
  }
}

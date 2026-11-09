import { db, now } from "@/lib/db";

/**
 * Record a job in the `runs` table so the UI can show its status. When started from the UI,
 * the web server has already created the row and passes its id in RADAR_RUN_ID.
 */
export async function tracked(kind: string, fn: (stats: Record<string, unknown>) => Promise<void>) {
  const d = db();
  let id = Number(process.env.RADAR_RUN_ID ?? 0);
  if (!id || !d.prepare("SELECT 1 FROM runs WHERE id = ?").get(id)) {
    // Scheduled runs pass their log file in RADAR_LOG so the Run panel can show it too.
    id = Number(
      d.prepare("INSERT INTO runs(kind, started_at, pid, log) VALUES(?, ?, ?, ?)").run(kind, now(), process.pid, process.env.RADAR_LOG ?? null).lastInsertRowid
    );
  }
  const stats: Record<string, unknown> = {};
  try {
    await fn(stats);
    d.prepare("UPDATE runs SET finished_at=?, stats=? WHERE id=?").run(now(), JSON.stringify(stats), id);
  } catch (e) {
    d.prepare("UPDATE runs SET finished_at=?, stats=?, error=? WHERE id=?").run(now(), JSON.stringify(stats), String((e as Error).stack ?? e), id);
    throw e;
  }
}

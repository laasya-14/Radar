// Extra read/write helpers for the UI. db.ts is the shared contract; this builds on it.
import { db, now, kvGet, kvSet } from "./db";

export type RunRow = {
  id: number;
  kind: string;
  started_at: string;
  finished_at: string | null;
  stats: string | null;
  error: string | null;
};

export function latestRun(): RunRow | null {
  return (db().prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1").get() as RunRow | undefined) ?? null;
}

export type DigestSummary = { id: number; created_at: string; n: number };

export function listDigests(limit = 20): DigestSummary[] {
  return db()
    .prepare(
      "SELECT id, created_at, json_array_length(item_ids) n FROM digests ORDER BY id DESC LIMIT ?"
    )
    .all(limit) as DigestSummary[];
}

export function getDigest(id: number) {
  return (
    (db().prepare("SELECT * FROM digests WHERE id = ?").get(id) as
      | { id: number; created_at: string; item_ids: string; intro: string | null }
      | undefined) ?? null
  );
}

// ---------- Feedback ----------

export type FeedbackAction =
  | "like"
  | "dislike"
  | "clear"
  | "save"
  | "unsave"
  | "explored"
  | "unexplored"
  | "open"
  | "note";

export const FEEDBACK_ACTIONS: FeedbackAction[] = [
  "like",
  "dislike",
  "clear",
  "save",
  "unsave",
  "explored",
  "unexplored",
  "open",
  "note",
];

type StateRow = {
  rating: number;
  saved: number;
  explored: number;
  reasons: string | null;
  note: string | null;
};

export function recordFeedback(
  itemId: string,
  action: FeedbackAction,
  reasons?: string[] | null,
  note?: string | null
) {
  const d = db();
  const exists = d.prepare("SELECT 1 FROM items WHERE id = ?").get(itemId);
  if (!exists) throw new Error("unknown item");

  const ts = now();
  const payload =
    reasons || note != null ? JSON.stringify({ reasons: reasons ?? undefined, note: note ?? undefined }) : null;
  d.prepare("INSERT INTO feedback(item_id, action, payload, created_at) VALUES(?,?,?,?)").run(
    itemId,
    action,
    payload,
    ts
  );
  if (action === "open") return getState(itemId);

  const cur: StateRow =
    (d.prepare("SELECT rating, saved, explored, reasons, note FROM item_state WHERE item_id = ?").get(itemId) as
      | StateRow
      | undefined) ?? { rating: 0, saved: 0, explored: 0, reasons: null, note: null };

  const next: StateRow = { ...cur };
  switch (action) {
    case "like":
      next.rating = 1;
      next.reasons = null;
      break;
    case "dislike":
      next.rating = -1;
      if (reasons) next.reasons = JSON.stringify(reasons);
      if (note != null) next.note = note || null;
      break;
    case "clear":
      next.rating = 0;
      next.reasons = null;
      break;
    case "save":
      next.saved = 1;
      break;
    case "unsave":
      next.saved = 0;
      break;
    case "explored":
      next.explored = 1;
      break;
    case "unexplored":
      next.explored = 0;
      break;
    case "note":
      next.note = note || null;
      break;
  }

  d.prepare(
    `INSERT INTO item_state(item_id, rating, saved, explored, reasons, note, updated_at)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(item_id) DO UPDATE SET rating=excluded.rating, saved=excluded.saved,
       explored=excluded.explored, reasons=excluded.reasons, note=excluded.note, updated_at=excluded.updated_at`
  ).run(itemId, next.rating, next.saved, next.explored, next.reasons, next.note, ts);
  return next;
}

function getState(itemId: string) {
  return db().prepare("SELECT rating, saved, explored, reasons, note FROM item_state WHERE item_id = ?").get(itemId);
}

// ---------- Taste stats ----------

export type TopicStat = { topic: string | null; likes: number; dislikes: number; saved: number; explored: number };

export function feedbackStatsByTopic(): TopicStat[] {
  return db()
    .prepare(
      `SELECT s.topic topic,
              SUM(st.rating = 1) likes, SUM(st.rating = -1) dislikes,
              SUM(st.saved) saved, SUM(st.explored) explored
       FROM item_state st JOIN scores s ON s.item_id = st.item_id
       GROUP BY s.topic`
    )
    .all() as TopicStat[];
}

export function dislikeReasonCounts(): { reason: string; n: number }[] {
  const rows = db()
    .prepare("SELECT reasons FROM item_state WHERE rating = -1 AND reasons IS NOT NULL")
    .all() as { reasons: string }[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    try {
      for (const reason of JSON.parse(r.reasons) as string[]) counts.set(reason, (counts.get(reason) ?? 0) + 1);
    } catch {
      /* ignore malformed */
    }
  }
  return [...counts.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n);
}

export function feedbackTotals() {
  return db()
    .prepare(
      `SELECT COUNT(*) events,
              (SELECT COUNT(*) FROM item_state WHERE rating = 1) likes,
              (SELECT COUNT(*) FROM item_state WHERE rating = -1) dislikes,
              (SELECT COUNT(*) FROM item_state WHERE saved = 1) saved
       FROM feedback`
    )
    .get() as { events: number; likes: number; dislikes: number; saved: number };
}

export function learnedPrefs(): { value: string; updated_at: string | null } {
  const r = db().prepare("SELECT value, updated_at FROM kv WHERE key = 'learned_prefs'").get() as
    | { value: string; updated_at: string }
    | undefined;
  return { value: r?.value ?? "", updated_at: r?.updated_at ?? null };
}

export function setLearnedPrefs(v: string) {
  kvSet("learned_prefs", v);
}

// ---------- Authors ----------

export type AuthorRow = {
  key: string;
  name: string | null;
  bio: string | null;
  followers: number | null;
  tier: string | null;
  trust: number | null;
  reason: string | null;
  override: string | null;
  vetted_at: string | null;
  seen_count: number;
};

export function listAuthors(filter: "trusted" | "rejected" | "all"): AuthorRow[] {
  const where =
    filter === "trusted"
      ? "WHERE (override = 'trust') OR (override IS NULL AND trust >= 0.6)"
      : filter === "rejected"
        ? "WHERE (override = 'block') OR (override IS NULL AND (trust < 0.6 OR trust IS NULL))"
        : "";
  return db()
    .prepare(`SELECT * FROM authors ${where} ORDER BY COALESCE(trust, 0) DESC, seen_count DESC LIMIT 500`)
    .all() as AuthorRow[];
}

export function authorCounts() {
  return db()
    .prepare(
      `SELECT COUNT(*) total,
              SUM((override = 'trust') OR (override IS NULL AND trust >= 0.6)) trusted
       FROM authors`
    )
    .get() as { total: number; trusted: number | null };
}

export function setAuthorOverride(key: string, override: "trust" | "block" | null) {
  db().prepare("UPDATE authors SET override = ? WHERE key = ?").run(override, key);
}

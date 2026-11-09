import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.RADAR_DB ?? path.join(process.cwd(), "data", "radar.db");

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const d = new DatabaseSync(DB_PATH);
  d.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: DatabaseSync) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id            TEXT PRIMARY KEY,          -- hash of canonical url
    url           TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title         TEXT NOT NULL,
    excerpt       TEXT,                      -- abstract / description / first paragraph
    domain        TEXT,
    lane          TEXT NOT NULL DEFAULT 'fresh', -- fresh | library
    published_at  TEXT,
    first_seen    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_seen ON items(first_seen);

  -- Every time a source surfaces an item (an HN post, a tweet linking it, an HF listing...)
  CREATE TABLE IF NOT EXISTS mentions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source      TEXT NOT NULL,               -- hn | x | hf | arxiv | github | rss
    source_id   TEXT NOT NULL,
    discuss_url TEXT,                        -- link to the discussion (HN thread, tweet)
    author      TEXT,                        -- handle / feed name
    text        TEXT,                        -- tweet text, HN title, etc.
    engagement  TEXT,                        -- JSON {points, comments, likes, upvotes, stars...}
    created_at  TEXT,
    UNIQUE(source, source_id)
  );
  CREATE INDEX IF NOT EXISTS idx_mentions_item ON mentions(item_id);

  -- People who posted on X (and later other platforms), vetted by background.
  CREATE TABLE IF NOT EXISTS authors (
    key        TEXT PRIMARY KEY,             -- e.g. x:karpathy
    name       TEXT,
    bio        TEXT,
    followers  INTEGER,
    tier       TEXT,                         -- professor | researcher | builder | oss | lab | org | commentator | hype | unknown
    trust      REAL,                         -- 0..1 from the vetting model
    reason     TEXT,
    override   TEXT,                         -- 'trust' | 'block' | NULL (your manual call)
    vetted_at  TEXT,
    seen_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scores (
    item_id      TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    triage       REAL,                       -- cheap first-pass score 0..10
    stage        TEXT NOT NULL,              -- triaged | rejected | scored
    topic        TEXT,
    kind         TEXT,                       -- paper | essay | repo | thread | talk | tool | news
    level        TEXT,                       -- intro | intermediate | advanced
    novelty      REAL,
    depth        REAL,
    learning     REAL,
    fit          REAL,
    is_wrapper   INTEGER,
    why          TEXT,                       -- why this is for you
    takeaway     TEXT,                       -- what you'll get out of it
    read_minutes INTEGER,
    endorse_count INTEGER,                   -- distinct people genuinely recommending it
    endorse_quote TEXT,                      -- best recommendation quote
    endorse_by    TEXT,
    final        REAL,                       -- combined ranking score
    scored_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_scores_final ON scores(final);

  -- Current state of your reaction to an item.
  CREATE TABLE IF NOT EXISTS item_state (
    item_id    TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL DEFAULT 0,   -- -1 | 0 | 1
    saved      INTEGER NOT NULL DEFAULT 0,
    explored   INTEGER NOT NULL DEFAULT 0,
    reasons    TEXT,                         -- JSON array of reason tags
    note       TEXT,
    updated_at TEXT
  );

  -- Append-only log of every click/mark, used for learning.
  CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    TEXT NOT NULL,
    action     TEXT NOT NULL,                -- like | dislike | clear | save | unsave | explored | open | note
    payload    TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS digests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    item_ids   TEXT NOT NULL,                -- JSON array, in display order
    intro      TEXT
  );

  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS runs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    stats      TEXT,
    error      TEXT
  );
  `);
  // Later additions to `runs`: which log file and process belong to a run started from the UI.
  const cols = new Set((d.prepare("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("log")) d.exec("ALTER TABLE runs ADD COLUMN log TEXT");
  if (!cols.has("pid")) d.exec("ALTER TABLE runs ADD COLUMN pid INTEGER");
}

export const now = () => new Date().toISOString();

export function kvGet(key: string): string | null {
  const r = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}
export function kvSet(key: string, value: string) {
  db()
    .prepare("INSERT INTO kv(key, value, updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .run(key, value, now());
}

// ---------- Shared row types (used by pipeline + UI) ----------

export type Engagement = { points?: number; comments?: number; likes?: number; retweets?: number; upvotes?: number; stars?: number; views?: number };

export type MentionRow = {
  source: string;
  source_id: string;
  discuss_url: string | null;
  author: string | null;
  text: string | null;
  engagement: string | null;
  created_at: string | null;
  author_tier?: string | null;
  author_name?: string | null;
};

export type FeedItem = {
  id: string;
  url: string;
  title: string;
  excerpt: string | null;
  domain: string | null;
  lane: string;
  published_at: string | null;
  first_seen: string;
  topic: string | null;
  kind: string | null;
  level: string | null;
  novelty: number | null;
  depth: number | null;
  learning: number | null;
  fit: number | null;
  why: string | null;
  takeaway: string | null;
  read_minutes: number | null;
  endorse_count: number | null;
  endorse_quote: string | null;
  endorse_by: string | null;
  final: number | null;
  rating: number;
  saved: number;
  explored: number;
  reasons: string | null;
  note: string | null;
  mentions: MentionRow[];
};

const ITEM_SELECT = `
  SELECT i.id, i.url, i.title, i.excerpt, i.domain, i.lane, i.published_at, i.first_seen,
         s.topic, s.kind, s.level, s.novelty, s.depth, s.learning, s.fit, s.why, s.takeaway,
         s.read_minutes, s.endorse_count, s.endorse_quote, s.endorse_by, s.final,
         COALESCE(st.rating,0) rating, COALESCE(st.saved,0) saved, COALESCE(st.explored,0) explored,
         st.reasons, st.note
  FROM items i
  JOIN scores s ON s.item_id = i.id
  LEFT JOIN item_state st ON st.item_id = i.id`;

function attachMentions(rows: Omit<FeedItem, "mentions">[]): FeedItem[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ms = db()
    .prepare(
      `SELECT m.item_id, m.source, m.source_id, m.discuss_url, m.author, m.text, m.engagement, m.created_at,
              a.tier author_tier, a.name author_name
       FROM mentions m LEFT JOIN authors a ON a.key = ('x:' || m.author) AND m.source = 'x'
       WHERE m.item_id IN (${ids.map(() => "?").join(",")})
       ORDER BY m.created_at`
    )
    .all(...ids) as (MentionRow & { item_id: string })[];
  const by = new Map<string, MentionRow[]>();
  for (const m of ms) {
    const arr = by.get(m.item_id) ?? [];
    arr.push(m);
    by.set(m.item_id, arr);
  }
  return rows.map((r) => ({ ...r, mentions: by.get(r.id) ?? [] }));
}

export function getItems(opts: {
  where?: string;
  params?: (string | number)[];
  order?: string;
  limit?: number;
}): FeedItem[] {
  const sql = `${ITEM_SELECT} WHERE s.stage = 'scored' ${opts.where ? `AND (${opts.where})` : ""}
    ORDER BY ${opts.order ?? "s.final DESC"} LIMIT ${opts.limit ?? 100}`;
  const rows = db().prepare(sql).all(...(opts.params ?? [])) as Omit<FeedItem, "mentions">[];
  return attachMentions(rows);
}

export function getItemsByIds(ids: string[]): FeedItem[] {
  if (ids.length === 0) return [];
  const rows = db()
    .prepare(`${ITEM_SELECT} WHERE i.id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Omit<FeedItem, "mentions">[];
  const order = new Map(ids.map((id, i) => [id, i]));
  return attachMentions(rows).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export type DigestRow = { id: number; created_at: string; item_ids: string; intro: string | null };

export function latestDigest(): DigestRow | null {
  return (db().prepare("SELECT * FROM digests ORDER BY id DESC LIMIT 1").get() as DigestRow | undefined) ?? null;
}

import { TOPICS, OK_ITEM_LEVELS, type Level } from "@config/topics";
import { topicLevels } from "@/lib/levels";
import { db, now } from "@/lib/db";
import { llmJson, MODELS } from "@/lib/llm";
import { log } from "@/lib/util";
import { PLAIN_STYLE } from "./context";

/**
 * Final score = judged quality × your feedback + independent signals.
 *   base      0.35·fit + 0.25·novelty + 0.20·learning + 0.20·depth          (0–10)
 *   + endorse  0.5 per person genuinely recommending it (max +1.5)
 *   + trusted  +0.6 if a highly-trusted researcher/builder posted it on X
 *   + cross    +0.4 per extra independent source (max +0.8)
 *   + learned  topic / domain / author affinity from your 👍👎 (±1.5 each)
 *   − wrapper  −4
 *   − age      −0.15/day after 2 days (fresh lane only)
 *   − level    too hard for your level in that field: −1.5 (two steps above), −0.75 (advanced
 *              when you know the basics); papers in fields you're new to: −0.75 (explainers first)
 */
/** How far an item is above what you asked for in its field (levels: Taste page / config/topics.ts). */
function levelPenalty(levels: Record<string, Level>, topic: string, itemLevel: string | null, kind: string | null): number {
  const yours = levels[topic];
  if (!yours || !itemLevel) return 0;
  let p = 0;
  if (!OK_ITEM_LEVELS[yours].includes(itemLevel)) {
    if (yours === "new" && itemLevel === "advanced") p += 1.5;
    else if (yours === "basics" && itemLevel === "advanced") p += 0.75;
  }
  if (yours === "new" && kind === "paper") p += 0.75;
  return p;
}

export function rank(): number {
  const d = db();
  const levels = topicLevels();

  // Affinity from your reactions: smoothed (likes − dislikes) / (n + 4).
  const affinity = (sql: string) => {
    const m = new Map<string, number>();
    for (const r of d.prepare(sql).all() as { k: string; up: number; down: number; n: number }[]) {
      if (r.k) m.set(r.k, (1.5 * (r.up - r.down)) / (r.n + 4));
    }
    return m;
  };
  const base = `SUM(CASE WHEN st.rating=1 OR st.saved=1 OR st.explored=1 THEN 1 ELSE 0 END) up, SUM(CASE WHEN st.rating=-1 THEN 1 ELSE 0 END) down, COUNT(*) n
                FROM item_state st JOIN items i ON i.id = st.item_id LEFT JOIN scores s ON s.item_id = i.id`;
  const topicAff = affinity(`SELECT s.topic k, ${base} GROUP BY s.topic`);
  const domainAff = affinity(`SELECT i.domain k, ${base} GROUP BY i.domain`);
  const authorAff = affinity(`SELECT m.author k, ${base} JOIN mentions m ON m.item_id = i.id AND m.source IN ('x','rss') GROUP BY m.author`);

  const rows = d
    .prepare(
      `SELECT s.item_id, s.topic, s.kind, s.level, s.novelty, s.depth, s.learning, s.fit, s.is_wrapper, s.endorse_count, i.domain, i.lane, i.first_seen,
              (SELECT COUNT(DISTINCT source) FROM mentions WHERE item_id = i.id) nsources,
              (SELECT MAX(CASE WHEN a.override='trust' THEN 1 WHEN a.override='block' THEN 0 ELSE COALESCE(a.trust,0) END)
                 FROM mentions m JOIN authors a ON a.key = 'x:' || m.author WHERE m.item_id = i.id AND m.source='x') xtrust,
              (SELECT GROUP_CONCAT(author) FROM mentions WHERE item_id = i.id AND source IN ('x','rss')) authors,
              (SELECT COUNT(DISTINCT m.author) FROM mentions m JOIN authors a ON a.key = 'x:' || m.author
                 WHERE m.item_id = i.id AND m.source='x' AND (a.override='trust' OR (a.trust >= 0.7 AND a.override IS NOT 'block'))) xendorsers
       FROM scores s JOIN items i ON i.id = s.item_id WHERE s.stage = 'scored'`
    )
    .all() as {
    item_id: string; topic: string; kind: string | null; level: string | null; novelty: number; depth: number; learning: number; fit: number; is_wrapper: number;
    endorse_count: number | null; domain: string | null; lane: string; first_seen: string; nsources: number;
    xtrust: number | null; authors: string | null; xendorsers: number;
  }[];

  const up = d.prepare("UPDATE scores SET final = ? WHERE item_id = ?");
  d.exec("BEGIN");
  for (const r of rows) {
    let s = 0.35 * r.fit + 0.25 * r.novelty + 0.2 * r.learning + 0.2 * r.depth;
    const people = (r.endorse_count ?? 0) + Math.max(0, r.xendorsers - 1);
    s += Math.min(1.5, 0.5 * people);
    if ((r.xtrust ?? 0) >= 0.8) s += 0.6;
    s += Math.min(0.8, 0.4 * Math.max(0, r.nsources - 1));
    s += topicAff.get(r.topic) ?? 0;
    if (r.domain) s += domainAff.get(r.domain) ?? 0;
    const authorBoost = (r.authors ?? "").split(",").map((a) => authorAff.get(a) ?? 0);
    if (authorBoost.length) s += Math.max(...authorBoost.map((v) => Math.max(-1.5, Math.min(1.5, v))));
    if (r.is_wrapper) s -= 4;
    s -= levelPenalty(levels, r.topic, r.level, r.kind);
    if (r.lane === "fresh") {
      const age = (Date.now() - new Date(r.first_seen).getTime()) / 86400_000;
      s -= Math.max(0, age - 2) * 0.15;
    }
    up.run(Math.round(s * 100) / 100, r.item_id);
  }
  d.exec("COMMIT");
  return rows.length;
}

/**
 * The every-two-days digest: best unseen fresh items with per-topic quotas (so robotics and
 * astronomy aren't drowned out by LLM news), a few library classics, and a couple of
 * "outside your bubble" picks chosen for novelty rather than fit.
 */
export async function buildDigest(opts: { size?: number; minScore?: number } = {}): Promise<number | null> {
  const d = db();
  const size = opts.size ?? 20;
  const minScore = opts.minScore ?? 6;
  const shown = new Set<string>();
  for (const r of d.prepare("SELECT item_ids FROM digests").all() as { item_ids: string }[]) for (const id of JSON.parse(r.item_ids)) shown.add(id);

  type Row = { id: string; title: string; topic: string; final: number; novelty: number; fit: number; why: string };
  const fresh = (
    d
      .prepare(
        `SELECT i.id, i.title, s.topic, s.final, s.novelty, s.fit, s.why FROM items i JOIN scores s ON s.item_id = i.id
         LEFT JOIN item_state st ON st.item_id = i.id
         WHERE s.stage='scored' AND i.lane='fresh' AND COALESCE(s.is_wrapper,0)=0 AND COALESCE(st.rating,0)=0
           AND COALESCE(st.explored,0)=0 AND i.first_seen > datetime('now','-6 days')
         ORDER BY s.final DESC`
      )
      .all() as Row[]
  ).filter((r) => !shown.has(r.id));

  const picked: Row[] = [];
  const perTopic = new Map<string, number>();
  // Pass 1: best item from every topic that has something good (breadth first).
  for (const t of TOPICS) {
    const best = fresh.find((r) => r.topic === t.id && r.final >= minScore);
    if (best) {
      picked.push(best);
      perTopic.set(t.id, 1);
    }
  }
  // Pass 2: fill by score within quotas.
  for (const r of fresh) {
    if (picked.length >= size) break;
    if (picked.includes(r) || r.final < minScore) continue;
    const quota = TOPICS.find((t) => t.id === r.topic)?.digestQuota ?? 2;
    if ((perTopic.get(r.topic) ?? 0) >= quota) continue;
    picked.push(r);
    perTopic.set(r.topic, (perTopic.get(r.topic) ?? 0) + 1);
  }
  // Exploration: high novelty, lower fit — things you might not know you'd like.
  const explore = fresh
    .filter((r) => !picked.includes(r) && r.novelty >= 7 && r.fit < 7)
    .sort((a, b) => b.novelty - a.novelty)
    .slice(0, 2);

  const library = (
    d
      .prepare(
        `SELECT i.id, i.title, s.topic, s.final, s.novelty, s.fit, s.why FROM items i JOIN scores s ON s.item_id = i.id
         LEFT JOIN item_state st ON st.item_id = i.id
         WHERE s.stage='scored' AND i.lane='library' AND COALESCE(st.rating,0)=0 AND COALESCE(st.explored,0)=0
         ORDER BY s.final DESC LIMIT 300`
      )
      .all() as Row[]
  ).filter((r) => !shown.has(r.id));

  // Fields you're new to (or know the basics of) with nothing fresh at your level this time get
  // their best "learn the basics" classic instead, so they're never silently missing.
  const levels = topicLevels();
  const libraryPicks: Row[] = [];
  for (const t of TOPICS) {
    if (perTopic.get(t.id) || !["new", "basics"].includes(levels[t.id])) continue;
    const best = library.find((r) => r.topic === t.id && r.final >= minScore);
    if (best) libraryPicks.push(best);
  }
  // Plus the 3 best classics overall.
  for (const r of library.filter((x) => !libraryPicks.includes(x)).slice(0, 3)) libraryPicks.push(r);

  const all = [...picked, ...explore, ...libraryPicks];
  if (!all.length) {
    log("digest", "nothing new to put in a digest");
    return null;
  }

  let intro: string | null = null;
  try {
    const res = await llmJson<{ intro: string }>({
      model: MODELS.judge,
      label: "digest-intro",
      system: `Write a short opener (2-3 sentences) for a personal reading digest. Name the 2-3 most interesting themes across these items and why they matter. No hype, no greeting, address the reader as "you".\n\n${PLAIN_STYLE}`,
      prompt: all.map((r) => `- [${r.topic}] ${r.title} — ${r.why}`).join("\n"),
      schema: { type: "object", properties: { intro: { type: "string" } }, required: ["intro"] },
    });
    intro = res.intro;
  } catch (e) {
    log("digest", `intro failed: ${(e as Error).message}`);
  }

  const r = d.prepare("INSERT INTO digests(created_at, item_ids, intro) VALUES(?,?,?)").run(now(), JSON.stringify(all.map((x) => x.id)), intro);
  log("digest", `built #${r.lastInsertRowid} with ${picked.length} fresh, ${explore.length} explore, ${libraryPicks.length} library`);
  return Number(r.lastInsertRowid);
}

export function digestDue(hours = Number(process.env.RADAR_DIGEST_HOURS ?? 46)): boolean {
  const last = db().prepare("SELECT created_at FROM digests ORDER BY id DESC LIMIT 1").get() as { created_at: string } | undefined;
  return !last || Date.now() - new Date(last.created_at).getTime() > hours * 3600_000;
}


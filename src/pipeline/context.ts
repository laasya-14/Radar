import fs from "node:fs";
import path from "node:path";
import { TOPICS } from "@config/topics";
import { db, kvGet } from "@/lib/db";
import { levelGuidance } from "@/lib/levels";

export function profileText(): string {
  return fs.readFileSync(path.join(process.cwd(), "config", "profile.md"), "utf8");
}

export function learnedPrefs(): string {
  return kvGet("learned_prefs")?.trim() || "(nothing learned yet — no feedback so far)";
}

export function topicsText(): string {
  return TOPICS.map((t) => `- ${t.id} — ${t.name}: ${t.brief}\n    ${levelGuidance(t.id)}`).join("\n");
}

/** Recent reactions, so the judge calibrates on concrete examples of your taste. */
export function feedbackExamples(limit = 15): string {
  const rows = (rating: number) =>
    db()
      .prepare(
        `SELECT i.title, i.domain, s.topic, st.reasons, st.note FROM item_state st
         JOIN items i ON i.id = st.item_id LEFT JOIN scores s ON s.item_id = i.id
         WHERE st.rating = ? ORDER BY st.updated_at DESC LIMIT ?`
      )
      .all(rating, limit) as { title: string; domain: string; topic: string; reasons: string | null; note: string | null }[];
  const fmt = (r: { title: string; domain: string; topic: string; reasons: string | null; note: string | null }) => {
    const reasons = r.reasons ? (JSON.parse(r.reasons) as string[]).join(", ") : "";
    return `  - "${r.title}" (${r.domain ?? "?"}, ${r.topic ?? "?"})${reasons ? ` — reasons: ${reasons}` : ""}${r.note ? ` — note: ${r.note}` : ""}`;
  };
  const liked = rows(1);
  const disliked = rows(-1);
  const saved = db()
    .prepare(`SELECT i.title, i.domain, s.topic, NULL reasons, st.note FROM item_state st JOIN items i ON i.id = st.item_id LEFT JOIN scores s ON s.item_id = i.id WHERE st.saved = 1 AND st.rating = 0 ORDER BY st.updated_at DESC LIMIT ?`)
    .all(Math.ceil(limit / 2)) as Parameters<typeof fmt>[0][];
  if (!liked.length && !disliked.length && !saved.length) return "(no feedback yet)";
  return [
    liked.length ? `Liked:\n${liked.map(fmt).join("\n")}` : "",
    saved.length ? `Saved to explore:\n${saved.map(fmt).join("\n")}` : "",
    disliked.length ? `Disliked:\n${disliked.map(fmt).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const TOPIC_IDS = TOPICS.map((t) => t.id);

/** House style for everything the reader sees (why, takeaway, digest intro, learned notes). */
export const PLAIN_STYLE = `Writing style for anything the reader sees:
- Plain, everyday English. Short sentences (aim for under 20 words). One idea per sentence.
- Say what the thing is and why it matters, simply — like explaining it to a smart friend over coffee.
- Write for a good software engineer who is NOT an expert in this field. Any term they wouldn't already know (e.g. "SSA", "lattice reduction", "linear attention", "Lie groups") must either be dropped or explained in a few plain words right where it appears (e.g. "a KV cache — the model's memory of what it has already read").
- Keep a technical term only if it's the real name worth learning; otherwise just describe the idea.
- Don't stack terms: at most one new term per sentence.
- No buzzwords or filler ("leverages", "paradigm", "novel", "robust", "state-of-the-art", "it's worth noting").
- Prefer concrete facts (numbers, what was built, what changed) over abstract claims.`;

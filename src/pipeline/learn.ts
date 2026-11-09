import { db, kvGet, kvSet, now } from "@/lib/db";
import { llmJson, MODELS } from "@/lib/llm";
import { log } from "@/lib/util";
import { loadEnv } from "./env";
import { profileText, PLAIN_STYLE } from "./context";
import { tracked } from "./track";

/**
 * Rewrites the "learned preferences" note from everything you've marked. This note is fed to
 * the judge on every run, next to your own profile. You can read and edit it on the Taste page.
 */
export async function learn(): Promise<boolean> {
  const rows = db()
    .prepare(
      `SELECT i.title, i.domain, s.topic, s.kind, s.level, st.rating, st.saved, st.explored, st.reasons, st.note
       FROM item_state st JOIN items i ON i.id = st.item_id LEFT JOIN scores s ON s.item_id = i.id
       WHERE st.rating != 0 OR st.saved = 1 OR st.explored = 1 OR st.note IS NOT NULL
       ORDER BY st.updated_at DESC LIMIT 300`
    )
    .all() as { title: string; domain: string; topic: string; kind: string; level: string; rating: number; saved: number; explored: number; reasons: string | null; note: string | null }[];
  if (rows.length < 3) {
    log("learn", "need at least 3 reactions before learning");
    return false;
  }
  const lines = rows.map((r) => {
    const verdict = r.rating === 1 ? "LIKED" : r.rating === -1 ? "DISLIKED" : r.explored ? "EXPLORED" : "SAVED";
    const reasons = r.reasons ? ` reasons=${(JSON.parse(r.reasons) as string[]).join("/")}` : "";
    return `${verdict}: "${r.title}" [${r.topic}, ${r.kind}, ${r.level}, ${r.domain}]${reasons}${r.note ? ` note="${r.note}"` : ""}`;
  });
  const res = await llmJson<{ prefs: string }>({
    model: MODELS.judge,
    label: "learn",
    system: `You maintain a short "learned preferences" note for a personal reader's ranking judge. Read the reader's own profile, their previous learned note, and their reactions. Write an updated note of at most 15 bullets: concrete, specific patterns (subtopics, kinds, depth/level, sources, styles) they like or dislike, including surprises not covered by their profile. Keep still-valid points from the old note; drop ones contradicted by new reactions. No generic statements. Markdown bullets only. The reader will read this note too, so write each bullet in plain, simple words.\n\n${PLAIN_STYLE}`,
    prompt: `## Reader's profile\n${profileText()}\n\n## Previous learned note\n${kvGet("learned_prefs") ?? "(none)"}\n\n## Reactions (newest first)\n${lines.join("\n")}`,
    schema: { type: "object", properties: { prefs: { type: "string" } }, required: ["prefs"] },
  });
  kvSet("learned_prefs", res.prefs.trim());
  kvSet("learned_at", now());
  log("learn", `updated learned preferences from ${rows.length} reactions`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  tracked("learn", async (stats) => {
    stats.learned = await learn();
  })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

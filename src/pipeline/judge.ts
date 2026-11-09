import { db, now, type Engagement } from "@/lib/db";
import { llmJson, MODELS } from "@/lib/llm";
import { chunk, fetchText, log, mapLimit, stripHtml } from "@/lib/util";
import { fetchHNComments } from "@/collectors/hn";
import { feedbackExamples, learnedPrefs, profileText, topicsText, TOPIC_IDS, PLAIN_STYLE } from "./context";

const TRUSTED = 0.55; // minimum vetting score for an X author's post to be considered

// ---------------------------------------------------------------------------------------------
// 1. Vet X authors by background (no hand-made list: the work and the person decide).
// ---------------------------------------------------------------------------------------------
export async function vetAuthors(): Promise<number> {
  const pending = db()
    .prepare("SELECT key, name, bio, followers FROM authors WHERE vetted_at IS NULL AND key LIKE 'x:%' LIMIT 400")
    .all() as { key: string; name: string | null; bio: string | null; followers: number | null }[];
  if (!pending.length) return 0;

  const system = `You vet social-media accounts for a personal research reader. Decide from name, handle, bio and follower count whether this person is someone whose posts are worth reading for deep, fundamental technical work.

HIGH trust (0.75-1.0):
- professor | researcher: faculty or researchers at strong universities/labs, or with a recognisable body of research.
- builder: engineers/founders doing fundamental technical work (infra, compilers, networking, models, robotics, security research) — at any size of company.
- oss: serious open-source maintainers/contributors, genuine hackers who build and ship things.
- lab: official accounts of research labs/teams that post primary research.
MEDIUM (0.4-0.7): plausible practitioners with thin evidence (e.g. "ML engineer", "PhD student"), or orgs that sometimes post substance.
LOW (0-0.35):
- commentator: generic tech commentary, "AI news", aggregators, newsletter-growth, hot takes, "follow for more".
- hype: crypto/AI hype, engagement farming, growth hackers, course sellers, "prompt engineers", thread-bois.
- unknown: no information.
Anyone whose bio is mainly about selling or audience-building — courses, cohorts, coaching, consulting funnels, "DM me", paid newsletters, "helping X do Y with AI", affiliate/link-in-bio, "I teach N people" — is commentator/hype with trust <= 0.3, even if they mention a real job.
Be strict: big follower counts alone mean nothing. A short bio naming a real lab, university, notable project or repo is a strong signal.`;

  let done = 0;
  for (const batch of chunk(pending, 30)) {
    const prompt = batch
      .map((a, i) => `[${i}] @${a.key.slice(2)} | name: ${a.name ?? "?"} | followers: ${a.followers ?? "?"} | bio: ${(a.bio ?? "").replace(/\s+/g, " ").slice(0, 300)}`)
      .join("\n");
    try {
      const res = await llmJson<{ authors: { i: number; tier: string; trust: number; reason: string }[] }>({
        model: MODELS.triage,
        label: "vet",
        system,
        prompt: `Vet these accounts:\n${prompt}`,
        schema: {
          type: "object",
          properties: {
            authors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  i: { type: "integer" },
                  tier: { type: "string", enum: ["professor", "researcher", "builder", "oss", "lab", "org", "commentator", "hype", "unknown"] },
                  trust: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["i", "tier", "trust", "reason"],
              },
            },
          },
          required: ["authors"],
        },
      });
      const up = db().prepare("UPDATE authors SET tier=?, trust=?, reason=?, vetted_at=? WHERE key=?");
      for (const a of res.authors) {
        const row = batch[a.i];
        if (row) up.run(a.tier, Math.max(0, Math.min(1, a.trust)), a.reason.slice(0, 300), now(), row.key);
      }
      done += res.authors.length;
    } catch (e) {
      log("vet", (e as Error).message);
    }
  }
  return done;
}

// ---------------------------------------------------------------------------------------------
// 2. Triage: cheap model, many items per call, drops the obvious noise.
// ---------------------------------------------------------------------------------------------
type Pending = { id: string; title: string; excerpt: string | null; domain: string | null; lane: string; sources: string };

export async function triage(): Promise<{ kept: number; rejected: number }> {
  const d = db();
  const pending = d
    .prepare(
      `SELECT i.id, i.title, i.excerpt, i.domain, i.lane, GROUP_CONCAT(DISTINCT m.source) sources
       FROM items i JOIN mentions m ON m.item_id = i.id
       LEFT JOIN scores s ON s.item_id = i.id
       WHERE s.item_id IS NULL AND (i.lane = 'library' OR i.first_seen > datetime('now','-5 days'))
       GROUP BY i.id`
    )
    .all() as Pending[];
  if (!pending.length) return { kept: 0, rejected: 0 };

  const reject = d.prepare("INSERT OR REPLACE INTO scores(item_id, stage, triage, why, scored_at) VALUES(?, 'rejected', ?, ?, ?)");
  const keep = d.prepare("INSERT OR REPLACE INTO scores(item_id, stage, triage, topic, is_wrapper, scored_at) VALUES(?, 'triaged', ?, ?, ?, ?)");

  // X-only items must come from at least one person who passed vetting.
  const authorTrust = d.prepare(
    `SELECT MAX(CASE WHEN a.override='trust' THEN 1 WHEN a.override='block' THEN 0 ELSE COALESCE(a.trust,0) END) t
     FROM mentions m LEFT JOIN authors a ON a.key = 'x:' || m.author WHERE m.item_id = ? AND m.source = 'x'`
  );
  const queue: Pending[] = [];
  let rejected = 0;
  for (const p of pending) {
    if (p.sources === "x") {
      const t = (authorTrust.get(p.id) as { t: number | null }).t ?? 0;
      if (t < TRUSTED) {
        reject.run(p.id, 0, "posted only by accounts that didn't pass background vetting", now());
        rejected++;
        continue;
      }
    }
    queue.push(p);
  }

  const system = `You are a strict first-pass filter for a personal reader. The reader's topics:
${topicsText()}

Reader's profile (what they want and DON'T want):
${profileText()}

For each item, decide the best-matching topic id (or "none") and a 0-10 score for "worth showing to this reader at all". Be harsh: most items should score below 6. Score >= 7 only for substantive, fundamental, novel or genuinely educational work squarely in a topic. Flag wrappers (thin LLM-API glue products, "ChatGPT for X", yet-another framework with nothing new), hype/commentary, and promotion (the point is to sell a course/product/newsletter, generate leads or grow an audience — e.g. company marketing posts, "I made $X with AI", sponsored content) — set wrapper=true for those too.`;

  let kept = 0;
  await mapLimit(chunk(queue, 40), 3, async (batch) => {
    const lines = batch
      .map((p, i) => `[${i}] (${p.sources}${p.lane === "library" ? ", all-time classic" : ""}) ${p.title} [${p.domain ?? ""}] — ${(p.excerpt ?? "").replace(/\s+/g, " ").slice(0, 280)}`)
      .join("\n");
    try {
      const res = await llmJson<{ items: { i: number; topic: string; score: number; wrapper: boolean }[] }>({
        model: MODELS.triage,
        label: "triage",
        system,
        prompt: `Items:\n${lines}`,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  i: { type: "integer" },
                  topic: { type: "string", enum: [...TOPIC_IDS, "none"] },
                  score: { type: "number" },
                  wrapper: { type: "boolean" },
                },
                required: ["i", "topic", "score", "wrapper"],
              },
            },
          },
          required: ["items"],
        },
      });
      for (const r of res.items) {
        const p = batch[r.i];
        if (!p) continue;
        if (r.topic === "none" || r.wrapper || r.score < 6) {
          reject.run(p.id, r.score, r.wrapper ? "wrapper" : r.topic === "none" ? "off-topic" : "low triage score", now());
          rejected++;
        } else {
          keep.run(p.id, r.score, r.topic, 0, now());
          kept++;
        }
      }
    } catch (e) {
      log("triage", (e as Error).message);
    }
  });
  return { kept, rejected };
}

// ---------------------------------------------------------------------------------------------
// 3. Enrich: fetch page text for links we only know by title (HN/X links).
// ---------------------------------------------------------------------------------------------
export async function enrich(): Promise<number> {
  const d = db();
  const rows = d
    .prepare(
      `SELECT i.id, i.url FROM items i JOIN scores s ON s.item_id = i.id
       WHERE s.stage = 'triaged' AND (i.excerpt IS NULL OR length(i.excerpt) < 300)
         AND i.domain NOT IN ('arxiv.org','github.com','x.com','twitter.com','youtube.com','youtu.be')`
    )
    .all() as { id: string; url: string }[];
  let n = 0;
  await mapLimit(rows, 6, async (r) => {
    try {
      const html = await fetchText(r.url, { timeoutMs: 12000, retries: 0 });
      const meta = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
      const body = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
      const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1], 2000)).filter((t) => t.length > 60);
      const text = [stripHtml(meta, 400), ...paras].join(" ").slice(0, 2500);
      if (text.length > 100) {
        d.prepare("UPDATE items SET excerpt = ? WHERE id = ?").run(text, r.id);
        n++;
      }
    } catch {
      /* unreachable pages are fine — the judge works from the title + discussion */
    }
  });
  return n;
}

// ---------------------------------------------------------------------------------------------
// 4. Judge: the stronger model scores each surviving item against your full taste profile.
// ---------------------------------------------------------------------------------------------
function signalSummary(itemId: string): string {
  const ms = db()
    .prepare(
      `SELECT m.source, m.author, m.text, m.engagement, a.tier, a.trust, a.bio FROM mentions m
       LEFT JOIN authors a ON a.key = 'x:' || m.author AND m.source = 'x' WHERE m.item_id = ?`
    )
    .all(itemId) as { source: string; author: string | null; text: string | null; engagement: string | null; tier: string | null; trust: number | null; bio: string | null }[];
  const parts: string[] = [];
  for (const m of ms) {
    const e: Engagement = m.engagement ? JSON.parse(m.engagement) : {};
    if (m.source === "hn") parts.push(`Hacker News: ${e.points ?? 0} points, ${e.comments ?? 0} comments`);
    else if (m.source === "hf") parts.push(`HF Daily Papers: ${e.upvotes ?? 0} upvotes${e.stars ? `, repo ${e.stars} stars` : ""}`);
    else if (m.source === "github") parts.push(`GitHub: ${e.stars ?? 0} stars (new repo)`);
    else if (m.source === "arxiv") parts.push(`arXiv listing (${m.text})`);
    else if (m.source === "rss") parts.push(`Blog: ${m.author}`);
    else if (m.source === "x" && (m.trust ?? 0) >= TRUSTED)
      parts.push(`X post by @${m.author} (${m.tier}; ${(m.bio ?? "").slice(0, 120)}) [${e.likes ?? 0} likes]: "${(m.text ?? "").replace(/\s+/g, " ").slice(0, 400)}"`);
  }
  return [...new Set(parts)].slice(0, 6).join("\n    ");
}

type Judged = {
  i: number;
  topic: string;
  kind: string;
  level: string;
  novelty: number;
  depth: number;
  learning: number;
  fit: number;
  is_wrapper: boolean;
  why: string;
  takeaway: string;
  read_minutes: number;
};

export async function judge(): Promise<number> {
  const d = db();
  const rows = d
    .prepare(
      `SELECT i.id, i.title, i.url, i.domain, i.excerpt, i.lane, s.topic FROM items i JOIN scores s ON s.item_id = i.id
       WHERE s.stage = 'triaged' ORDER BY s.triage DESC LIMIT 400`
    )
    .all() as { id: string; title: string; url: string; domain: string | null; excerpt: string | null; lane: string; topic: string }[];
  if (!rows.length) return 0;

  const system = `You are the judge for a personal reader that surfaces things worth exploring. You know this reader's taste deeply.

## Reader's own profile
${profileText()}

## Preferences learned from their feedback
${learnedPrefs()}

## Their recent reactions (calibrate on these)
${feedbackExamples()}

## Topics
${topicsText()}

## Scoring (0-10 each, use the whole range; 8+ should be rare)
- novelty: does it introduce a genuinely new idea/result/technique, or a creative, surprising angle? Rehashes and launches of "X but with AI" score low.
- depth: technical substance and rigour; primary source > coverage.
- learning: how much the reader would learn / build fundamentals from it.
- fit: how well it matches THIS reader's profile, learned preferences, topics AND their level in that topic.
  Level matters a lot. The reader wants things at their level or a little above — never the deepest, most specialised work in a field they're new to.
  If an item assumes expert background the reader doesn't have (dense math, field-specific jargon, narrow results), give fit <= 4 even if it's excellent work — unless it's a landmark result that a good engineer can still follow.
  In fields where the reader is NEW, prefer explainers, tutorials, talks and blog posts; a research paper scores well only if it's readable or a landmark.
- is_wrapper: true for thin LLM-wrapper products, prompt packs, yet-another-framework, hype/commentary, and anything whose main purpose is promotion (selling a course/product/newsletter, lead generation, audience growth, marketing dressed as insight).
- kind: paper | essay | repo | thread | talk | tool | news | discussion
- level: how much background it needs, for the field it's in: intro (anyone technical can follow) | intermediate (needs the basics of the field) | advanced (needs real expertise in the field)
- why: 1-2 short, simple sentences addressed to the reader ("you"): what this is and why it's worth their time. Concrete, no fluff, don't restate the title.
- takeaway: one short, simple sentence: what they'll understand or be able to do after exploring it.

${PLAIN_STYLE}
- read_minutes: realistic time to get the value (papers ~30-60).
"All-time classic" items come from the long-term library: judge them on lasting value today.`;

  const judgedSchema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            i: { type: "integer" },
            topic: { type: "string", enum: TOPIC_IDS },
            kind: { type: "string", enum: ["paper", "essay", "repo", "thread", "talk", "tool", "news", "discussion"] },
            level: { type: "string", enum: ["intro", "intermediate", "advanced"] },
            novelty: { type: "number" },
            depth: { type: "number" },
            learning: { type: "number" },
            fit: { type: "number" },
            is_wrapper: { type: "boolean" },
            why: { type: "string" },
            takeaway: { type: "string" },
            read_minutes: { type: "integer" },
          },
          required: ["i", "topic", "kind", "level", "novelty", "depth", "learning", "fit", "is_wrapper", "why", "takeaway", "read_minutes"],
        },
      },
    },
    required: ["items"],
  };

  const up = d.prepare(
    `UPDATE scores SET stage='scored', topic=?, kind=?, level=?, novelty=?, depth=?, learning=?, fit=?, is_wrapper=?, why=?, takeaway=?, read_minutes=?, scored_at=? WHERE item_id=?`
  );
  let n = 0;
  await mapLimit(chunk(rows, 6), 3, async (batch) => {
    const prompt = batch
      .map(
        (r, i) => `[${i}] ${r.title}${r.lane === "library" ? "  (all-time classic)" : ""}
  url: ${r.url}
  triage topic guess: ${r.topic}
  signals:
    ${signalSummary(r.id) || "(none)"}
  content: ${(r.excerpt ?? "(only the title is known)").replace(/\s+/g, " ").slice(0, 1600)}`
      )
      .join("\n\n");
    try {
      const res = await llmJson<{ items: Judged[] }>({ model: MODELS.judge, label: "judge", system, prompt: `Judge these items:\n\n${prompt}`, schema: judgedSchema });
      for (const j of res.items) {
        const r = batch[j.i];
        if (!r) continue;
        up.run(j.topic, j.kind, j.level, j.novelty, j.depth, j.learning, j.fit, j.is_wrapper ? 1 : 0, j.why, j.takeaway, j.read_minutes, now(), r.id);
        n++;
      }
    } catch (e) {
      log("judge", (e as Error).message);
    }
  });
  return n;
}

// ---------------------------------------------------------------------------------------------
// 5. Endorsements (the HackerTube idea): count distinct people who *genuinely recommend* it,
//    reading what they actually said rather than counting upvotes.
// ---------------------------------------------------------------------------------------------
export async function endorse(limit = 40): Promise<number> {
  const d = db();
  const rows = d
    .prepare(
      `SELECT s.item_id, i.title, m.source_id hn_id FROM scores s JOIN items i ON i.id = s.item_id
       JOIN mentions m ON m.item_id = s.item_id AND m.source = 'hn'
       WHERE s.stage = 'scored' AND s.endorse_count IS NULL AND COALESCE(s.is_wrapper,0) = 0
         AND CAST(json_extract(m.engagement, '$.comments') AS INTEGER) >= 8
       ORDER BY (s.fit + s.novelty + s.learning) DESC LIMIT ?`
    )
    .all(limit) as { item_id: string; title: string; hn_id: string }[];

  const up = d.prepare("UPDATE scores SET endorse_count=?, endorse_quote=?, endorse_by=? WHERE item_id=?");
  let n = 0;
  await mapLimit(rows, 3, async (r) => {
    try {
      const comments = (await fetchHNComments(r.hn_id)).filter((c) => c.text.length >= 120).slice(0, 45);
      if (!comments.length) {
        up.run(0, null, null, r.item_id);
        return;
      }
      const res = await llmJson<{ labels: { i: number; label: string; strength: number }[]; best: number }>({
        model: MODELS.triage,
        label: "endorse",
        system: `Label each Hacker News comment about the linked item "${r.title}":
- recommend: the commenter genuinely vouches for the item itself (learned from it, it's excellent/important/novel, they use it and it's good) — with real substance, not just "nice".
- cite: references it neutrally as a source.
- criticize: argues it's wrong, overhyped, or low quality.
- joke: humour/off-hand.
- discuss: tangential discussion.
strength: 0 weak, 1 clear, 2 strong and specific. "best": index of the single most informative recommend comment, or -1.`,
        prompt: comments.map((c, i) => `[${i}] ${c.author}: ${c.text}`).join("\n\n"),
        schema: {
          type: "object",
          properties: {
            labels: {
              type: "array",
              items: {
                type: "object",
                properties: { i: { type: "integer" }, label: { type: "string", enum: ["recommend", "cite", "criticize", "joke", "discuss"] }, strength: { type: "integer" } },
                required: ["i", "label", "strength"],
              },
            },
            best: { type: "integer" },
          },
          required: ["labels", "best"],
        },
      });
      const recommenders = new Set(res.labels.filter((l) => l.label === "recommend" && l.strength >= 1).map((l) => comments[l.i]?.author).filter(Boolean));
      const critics = new Set(res.labels.filter((l) => l.label === "criticize" && l.strength >= 1).map((l) => comments[l.i]?.author).filter(Boolean));
      const best = comments[res.best];
      // Net endorsement: strong criticism cancels out praise.
      const net = Math.max(0, recommenders.size - Math.floor(critics.size / 2));
      up.run(net, best ? best.text.slice(0, 400) : null, best ? `${best.author} on HN` : null, r.item_id);
      n++;
    } catch (e) {
      log("endorse", `${r.title}: ${(e as Error).message}`);
    }
  });
  return n;
}

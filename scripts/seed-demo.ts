// Fill a demo DB with realistic fake data so every UI page can be checked.
// Usage: RADAR_DB=data/demo.db npx tsx scripts/seed-demo.ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import { db, now } from "../src/lib/db";

if (!process.env.RADAR_DB || !process.env.RADAR_DB.includes("demo")) {
  console.error("Refusing to seed: set RADAR_DB to a demo path, e.g. RADAR_DB=data/demo.db");
  process.exit(1);
}
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(process.env.RADAR_DB + suffix, { force: true });

const d = db();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const id = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

type M = { source: string; sid: string; discuss?: string; author?: string; text?: string; eng?: object; h?: number };
type Seed = {
  url: string;
  title: string;
  excerpt: string;
  topic: string;
  kind: string;
  level: string;
  why: string;
  takeaway: string;
  mins: number;
  scores: [number, number, number, number]; // novelty, depth, learning, fit
  lane?: string;
  h: number;
  endorse?: [number, string, string];
  mentions: M[];
};

const SEEDS: Seed[] = [
  {
    url: "https://arxiv.org/abs/2611.01234",
    title: "Tools Need Not Speak in Text: Latent Context Compression for Agents",
    excerpt: "We show agents can pass tool results as compressed latent vectors instead of text, cutting context 6x.",
    topic: "agents", kind: "paper", level: "advanced",
    why: "A genuinely different take on agent context management — not a prompt trick, a change to the harness's data path.",
    takeaway: "How latent tool-result compression works and where it breaks for long-horizon tasks.",
    mins: 35, scores: [9, 8, 7, 9], h: 20,
    mentions: [
      { source: "hf", sid: "2611.01234", discuss: "https://huggingface.co/papers/2611.01234", eng: { upvotes: 84 } },
      { source: "x", sid: "1001", discuss: "https://x.com/srush_nlp/status/1001", author: "srush_nlp", text: "This is the most interesting agent paper I've read this month.", eng: { likes: 900 } },
      { source: "x", sid: "1002", discuss: "https://x.com/chrmanning/status/1002", author: "chrmanning", text: "Nice idea: tools returning latents.", eng: { likes: 410 } },
    ],
  },
  {
    url: "https://mitchellh.com/writing/my-ai-adoption-journey",
    title: "My AI adoption journey, one year later",
    excerpt: "What actually changed in how I write software after a year of agents, and what didn't.",
    topic: "eng-ai", kind: "essay", level: "intermediate",
    why: "A strong systems engineer's honest account of how his workflow changed — concrete habits, not tool lists.",
    takeaway: "Which tasks he delegates to agents, how he reviews their work, and where he still writes code by hand.",
    mins: 14, scores: [6, 8, 8, 9], h: 30,
    endorse: [7, "This matches my experience exactly — especially the part about reviewing diffs instead of writing them.", "tptacek"],
    mentions: [
      { source: "hn", sid: "50401111", discuss: "https://news.ycombinator.com/item?id=50401111", author: "mitchellh", eng: { points: 812, comments: 344 } },
      { source: "rss", sid: "mh-1", author: "Mitchell Hashimoto" },
    ],
  },
  {
    url: "https://tailscale.com/blog/how-nat-traversal-works-2026",
    title: "How NAT traversal works, revisited for IPv6 and CGNAT",
    excerpt: "An update to the classic post: what's changed with carrier-grade NAT and IPv6 in the last five years.",
    topic: "networking", kind: "essay", level: "intermediate",
    why: "Deep, first-principles networking from the people who built it — exactly the fundamentals you asked for.",
    takeaway: "Hole punching, STUN, DERP relays, and why CGNAT makes it harder.",
    mins: 28, scores: [6, 9, 9, 9], h: 40,
    endorse: [4, "Best explanation of NAT I've ever read, and this update is just as good.", "jvns"],
    mentions: [
      { source: "rss", sid: "ts-1", author: "Tailscale" },
      { source: "hn", sid: "50402222", discuss: "https://news.ycombinator.com/item?id=50402222", eng: { points: 455, comments: 120 } },
    ],
  },
  {
    url: "https://go.dev/blog/greenteagc",
    title: "The Green Tea garbage collector",
    excerpt: "A new GC design for Go that scans memory in spans rather than objects for better locality.",
    topic: "go", kind: "essay", level: "advanced",
    why: "A fundamental runtime change in Go explained by the people who designed it.",
    takeaway: "Why span-based marking improves cache behavior and what workloads benefit.",
    mins: 22, scores: [8, 9, 8, 8], h: 50,
    mentions: [
      { source: "rss", sid: "go-1", author: "The Go Blog" },
      { source: "hn", sid: "50403333", discuss: "https://news.ycombinator.com/item?id=50403333", eng: { points: 390, comments: 98 } },
    ],
  },
  {
    url: "https://googleprojectzero.blogspot.com/2026/11/agent-sandbox-escape.html",
    title: "Escaping an AI coding agent's sandbox through its own tool definitions",
    excerpt: "A full exploit chain against a popular agent harness, from prompt injection to host code execution.",
    topic: "security", kind: "essay", level: "advanced",
    why: "Real vulnerability research on agent harnesses — the intersection of two of your topics.",
    takeaway: "The exploit chain, why the sandbox assumptions failed, and the general lesson for harness design.",
    mins: 40, scores: [9, 9, 8, 9], h: 12,
    mentions: [
      { source: "rss", sid: "pz-1", author: "Project Zero" },
      { source: "x", sid: "1003", discuss: "https://x.com/halvarflake/status/1003", author: "halvarflake", text: "Excellent writeup.", eng: { likes: 1300 } },
    ],
  },
  {
    url: "https://blog.janestreet.com/oxidizing-ocaml-locality/",
    title: "Oxidizing OCaml: stack allocation with modes",
    excerpt: "How Jane Street added Rust-like locality guarantees to OCaml without a borrow checker.",
    topic: "langs", kind: "essay", level: "advanced",
    why: "A creative language-design idea from a team doing fundamental compiler work.",
    takeaway: "What 'modes' are, how they enable stack allocation, and the type-system trade-offs.",
    mins: 30, scores: [8, 9, 8, 8], h: 70,
    mentions: [{ source: "rss", sid: "js-1", author: "Jane Street Tech" }],
  },
  {
    url: "https://arxiv.org/abs/2611.04567",
    title: "Foundation models for galaxy morphology from 100 million unlabeled images",
    excerpt: "A self-supervised vision model trained on survey imagery that transfers to many astronomy tasks.",
    topic: "astro", kind: "paper", level: "intermediate",
    why: "AI used for real science in astronomy, written accessibly enough to follow without a physics PhD.",
    takeaway: "How self-supervised learning is changing how astronomers use huge sky surveys.",
    mins: 25, scores: [7, 7, 8, 7], h: 26,
    mentions: [
      { source: "arxiv", sid: "2611.04567", discuss: "https://arxiv.org/abs/2611.04567" },
      { source: "x", sid: "1004", discuss: "https://x.com/astro_jane/status/1004", author: "astro_jane", text: "Our new paper!", eng: { likes: 220 } },
    ],
  },
  {
    url: "https://evjang.com/2026/11/01/robot-learning-primer.html",
    title: "A primer on robot learning for software engineers",
    excerpt: "From PID loops to diffusion policies: the minimum you need to understand modern robot learning.",
    topic: "robotics", kind: "essay", level: "intro",
    why: "Exactly the kind of fundamentals-first explainer you wanted to get up to speed in robotics.",
    takeaway: "Control basics, imitation learning, diffusion policies and VLAs — and how they fit together.",
    mins: 45, scores: [6, 8, 10, 9], h: 34,
    endorse: [3, "If you're coming from software, start here.", "chris_j_paxton"],
    mentions: [
      { source: "rss", sid: "ej-1", author: "Eric Jang" },
      { source: "hn", sid: "50404444", discuss: "https://news.ycombinator.com/item?id=50404444", eng: { points: 302, comments: 77 } },
    ],
  },
  {
    url: "https://github.com/example/tiny-vla",
    title: "tiny-vla: a 300-line vision-language-action model you can train on one GPU",
    excerpt: "Minimal, readable implementation of a VLA policy with a simulated arm benchmark.",
    topic: "robotics", kind: "repo", level: "intermediate",
    why: "Learn VLAs by reading and running a tiny implementation — the nanoGPT approach applied to robotics.",
    takeaway: "End-to-end: tokenizing actions, training, and evaluating in simulation.",
    mins: 60, scores: [7, 7, 9, 8], h: 44,
    mentions: [{ source: "github", sid: "example/tiny-vla", discuss: "https://github.com/example/tiny-vla", eng: { stars: 2400 } }],
  },
  {
    url: "https://simonwillison.net/2026/Nov/5/context-rot/",
    title: "Context rot is the new memory leak",
    excerpt: "Why long agent sessions degrade, how to measure it, and patterns that help.",
    topic: "agents", kind: "essay", level: "intermediate",
    why: "Practical harness-design insight with measurements, from someone who builds and tests these tools daily.",
    takeaway: "How to detect context rot and three patterns for compaction.",
    mins: 12, scores: [7, 7, 8, 9], h: 16,
    mentions: [
      { source: "rss", sid: "sw-1", author: "Simon Willison" },
      { source: "hn", sid: "50405555", discuss: "https://news.ycombinator.com/item?id=50405555", eng: { points: 220, comments: 90 } },
    ],
  },
  {
    url: "https://example.com/chatgpt-for-spreadsheets",
    title: "Launch: the AI copilot for your spreadsheets",
    excerpt: "We built an AI assistant that lives inside your spreadsheets.",
    topic: "agents", kind: "tool", level: "intro",
    why: "Borderline — it's a wrapper, included so you can tell Radar whether launches like this are ever useful.",
    takeaway: "Product launch.",
    mins: 3, scores: [2, 2, 2, 3], h: 10,
    mentions: [{ source: "hn", sid: "50406666", discuss: "https://news.ycombinator.com/item?id=50406666", eng: { points: 140, comments: 60 } }],
  },
  {
    url: "https://words.filippo.io/ml-kem-go/",
    title: "Implementing ML-KEM in the Go standard library",
    excerpt: "Notes on writing post-quantum key exchange that is fast, constant-time and readable.",
    topic: "security", kind: "essay", level: "advanced",
    why: "Cryptography engineering from the Go crypto maintainer — security and Go fundamentals in one.",
    takeaway: "How ML-KEM works and the engineering choices behind a production implementation.",
    mins: 20, scores: [7, 9, 8, 8], h: 60,
    mentions: [{ source: "rss", sid: "fv-1", author: "Filippo Valsorda" }],
  },
  {
    url: "https://news.ycombinator.com/item?id=50407777",
    title: "Ask HN: How do you learn a new field quickly in 2026?",
    excerpt: "Discussion of learning strategies with and without AI tutors.",
    topic: "eng-ai", kind: "thread", level: "intro",
    why: "A thread full of experienced engineers sharing how they actually learn now — high signal in the comments.",
    takeaway: "Concrete learning loops people use with LLMs, and where they say AI hurts learning.",
    mins: 20, scores: [5, 6, 8, 8], h: 22,
    endorse: [5, "Building a tiny version of the thing beats any amount of reading.", "dang"],
    mentions: [{ source: "hn", sid: "50407777", discuss: "https://news.ycombinator.com/item?id=50407777", eng: { points: 510, comments: 402 } }],
  },
  {
    url: "https://arxiv.org/abs/2611.09999",
    title: "Self-play reasoning without verifiers",
    excerpt: "We show reasoning improves via self-play on unverifiable tasks using a learned critic ensemble.",
    topic: "agents", kind: "paper", level: "advanced",
    why: "Challenges the assumption that RL for reasoning needs verifiable rewards.",
    takeaway: "The critic-ensemble trick and where the gains come from.",
    mins: 40, scores: [9, 8, 7, 8], h: 8,
    mentions: [
      { source: "hf", sid: "2611.09999", discuss: "https://huggingface.co/papers/2611.09999", eng: { upvotes: 132 } },
      { source: "x", sid: "1005", discuss: "https://x.com/hype_ai_guy/status/1005", author: "hype_ai_guy", text: "THIS CHANGES EVERYTHING 🤯", eng: { likes: 5000 } },
    ],
  },
  {
    url: "https://www.quantamagazine.org/dark-energy-weakening-2026/",
    title: "New survey data strengthens the case that dark energy is weakening",
    excerpt: "DESI's third data release and what it means for the standard model of cosmology.",
    topic: "astro", kind: "news", level: "intro",
    why: "A clear explainer of the biggest open question in cosmology right now.",
    takeaway: "What dark energy is, what DESI measures, and why a weakening would matter.",
    mins: 15, scores: [7, 7, 8, 7], h: 55,
    mentions: [{ source: "rss", sid: "qm-1", author: "Quanta Magazine" }],
  },
  {
    url: "https://lemire.me/blog/2026/11/03/simd-json-cpp26/",
    title: "Parsing JSON at 10 GB/s with C++26 reflection",
    excerpt: "Using static reflection to generate SIMD-friendly parsers with no code generation step.",
    topic: "langs", kind: "essay", level: "advanced",
    why: "A new C++26 feature used for something genuinely new, by a researcher known for performance work.",
    takeaway: "How static reflection works and how it enables zero-cost serialization.",
    mins: 18, scores: [8, 8, 7, 7], h: 64,
    mentions: [{ source: "rss", sid: "dl-1", author: "Daniel Lemire" }],
  },
  // Library lane (evergreen)
  {
    url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
    title: "Let's build GPT: from scratch, in code, spelled out",
    excerpt: "A two-hour lecture building a transformer language model from an empty file.",
    topic: "agents", kind: "talk", level: "intermediate", lane: "library",
    why: "Recommended by many different people across years — the canonical way to understand transformers deeply.",
    takeaway: "Self-attention, training loop and generation, built from scratch.",
    mins: 120, scores: [5, 10, 10, 9], h: 900,
    endorse: [41, "The single best resource for actually understanding transformers.", "HN commenters, 2023–2026"],
    mentions: [{ source: "hn", sid: "34414716", discuss: "https://news.ycombinator.com/item?id=34414716", eng: { points: 1800, comments: 300 } }],
  },
  {
    url: "https://underactuated.mit.edu/",
    title: "Underactuated Robotics (MIT course notes, Russ Tedrake)",
    excerpt: "Algorithms for walking, running, swimming, flying and manipulation.",
    topic: "robotics", kind: "essay", level: "intermediate", lane: "library",
    why: "The most recommended free resource for robotics control fundamentals.",
    takeaway: "Dynamics, optimal control, trajectory optimization — with runnable notebooks.",
    mins: 600, scores: [5, 10, 10, 9], h: 2000,
    endorse: [12, "If you want to actually understand robot control, this is it.", "HN commenters"],
    mentions: [{ source: "hn", sid: "25123456", discuss: "https://news.ycombinator.com/item?id=25123456", eng: { points: 600, comments: 80 } }],
  },
  {
    url: "https://beej.us/guide/bgnet/",
    title: "Beej's Guide to Network Programming",
    excerpt: "Sockets, TCP, UDP and the rest, explained with good humor.",
    topic: "networking", kind: "essay", level: "intro", lane: "library",
    why: "Years of consistent recommendations as the clearest introduction to network programming.",
    takeaway: "Sockets from the ground up.",
    mins: 240, scores: [4, 8, 9, 8], h: 3000,
    endorse: [23, "Still the best intro to sockets after all these years.", "HN commenters"],
    mentions: [{ source: "hn", sid: "19356789", discuss: "https://news.ycombinator.com/item?id=19356789", eng: { points: 900, comments: 150 } }],
  },
  {
    url: "https://research.swtch.com/regexp",
    title: "Regular Expression Matching Can Be Simple And Fast",
    excerpt: "Thompson NFA vs backtracking regex engines.",
    topic: "langs", kind: "essay", level: "intermediate", lane: "library",
    why: "A classic that keeps being recommended — fundamentals of automata applied to real engineering.",
    takeaway: "Why backtracking engines blow up and how Thompson NFAs avoid it.",
    mins: 35, scores: [5, 9, 9, 8], h: 4000,
    endorse: [15, "Changed how I think about regex engines.", "HN commenters"],
    mentions: [{ source: "hn", sid: "466845", discuss: "https://news.ycombinator.com/item?id=466845", eng: { points: 400, comments: 60 } }],
  },
];

const insItem = d.prepare(
  "INSERT INTO items(id,url,canonical_url,title,excerpt,domain,lane,published_at,first_seen) VALUES(?,?,?,?,?,?,?,?,?)"
);
const insMention = d.prepare(
  "INSERT INTO mentions(item_id,source,source_id,discuss_url,author,text,engagement,created_at) VALUES(?,?,?,?,?,?,?,?)"
);
const insScore = d.prepare(
  `INSERT INTO scores(item_id,triage,stage,topic,kind,level,novelty,depth,learning,fit,is_wrapper,why,takeaway,read_minutes,
     endorse_count,endorse_quote,endorse_by,final,scored_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

const ids: string[] = [];
for (const s of SEEDS) {
  const iid = id(s.url);
  ids.push(iid);
  const domain = new URL(s.url).hostname.replace(/^www\./, "");
  insItem.run(iid, s.url, s.url, s.title, s.excerpt, domain, s.lane ?? "fresh", hoursAgo(s.h), hoursAgo(Math.min(s.h, 48)));
  for (const m of s.mentions) {
    insMention.run(iid, m.source, m.sid, m.discuss ?? null, m.author ?? null, m.text ?? null, m.eng ? JSON.stringify(m.eng) : null, hoursAgo(m.h ?? s.h));
  }
  const [n, dep, l, f] = s.scores;
  const final = Math.round((0.35 * f + 0.25 * n + 0.2 * ((dep + l) / 2) + (s.endorse ? 1 : 0.4)) * 10) / 10;
  const wrapper = n <= 2 ? 1 : 0;
  insScore.run(iid, 7, "scored", s.topic, s.kind, s.level, n, dep, l, f, wrapper, s.why, s.takeaway, s.mins,
    s.endorse?.[0] ?? null, s.endorse?.[1] ?? null, s.endorse?.[2] ?? null, wrapper ? 2.1 : final, now());
}

// A couple of rejected/triaged rows so stage filtering is exercised.
const rej = id("https://example.com/listicle");
insItem.run(rej, "https://example.com/listicle", "https://example.com/listicle", "10 AI tools you need", null, "example.com", "fresh", hoursAgo(5), hoursAgo(5));
insScore.run(rej, 1, "rejected", "agents", null, null, null, null, null, null, 1, null, null, null, null, null, null, null, now());

// Authors vetted from X
const insAuthor = d.prepare(
  "INSERT INTO authors(key,name,bio,followers,tier,trust,reason,override,vetted_at,seen_count) VALUES(?,?,?,?,?,?,?,?,?,?)"
);
insAuthor.run("x:srush_nlp", "Sasha Rush", "Professor @Cornell. NLP, ML.", 92000, "professor", 0.95, "Cornell professor publishing core NLP research.", null, now(), 14);
insAuthor.run("x:chrmanning", "Christopher Manning", "Professor of CS & Linguistics, Stanford.", 160000, "professor", 0.95, "Stanford NLP professor.", null, now(), 6);
insAuthor.run("x:halvarflake", "Halvar Flake", "Security researcher, reverse engineer.", 70000, "researcher", 0.9, "Long-time vulnerability researcher.", null, now(), 4);
insAuthor.run("x:astro_jane", "Jane Doe", "Postdoc in astrophysics, ML for surveys.", 2100, "researcher", 0.8, "Astrophysics postdoc publishing on ML for surveys.", null, now(), 2);
insAuthor.run("x:hype_ai_guy", "AI Daily 🚀", "Sharing the latest AI news daily. DM for promos.", 240000, "hype", 0.1, "Aggregator account; no original work.", null, now(), 31);
insAuthor.run("x:builder_bob", "Bob", "Building things. Ex-Google.", 4000, "builder", 0.55, "Vague bio; unclear whether work is fundamental.", "trust", now(), 3);

// Some feedback state
const fresh = SEEDS.map((s, i) => ({ s, iid: ids[i] }));
const st = d.prepare("INSERT INTO item_state(item_id,rating,saved,explored,reasons,note,updated_at) VALUES(?,?,?,?,?,?,?)");
const fb = d.prepare("INSERT INTO feedback(item_id,action,payload,created_at) VALUES(?,?,?,?)");
const pick = (needle: string) => fresh.find((f) => f.s.url.includes(needle))!.iid;
st.run(pick("tailscale"), 1, 1, 0, null, null, hoursAgo(3));
fb.run(pick("tailscale"), "like", null, hoursAgo(3));
st.run(pick("spreadsheets"), -1, 0, 0, JSON.stringify(["wrapper", "hype"]), "Never show me AI copilots for X", hoursAgo(2));
fb.run(pick("spreadsheets"), "dislike", JSON.stringify({ reasons: ["wrapper", "hype"] }), hoursAgo(2));
st.run(pick("greenteagc"), 1, 1, 1, null, null, hoursAgo(1));
st.run(pick("robot-learning-primer"), 0, 1, 0, null, null, hoursAgo(1));

d.prepare("INSERT INTO kv(key,value,updated_at) VALUES('learned_prefs',?,?)").run(
  "- Likes deep networking internals (NAT traversal, WireGuard).\n- Dislikes AI-copilot product launches (\"wrapper\").\n- Enjoys runtime/GC internals in Go.",
  hoursAgo(5)
);

// Digests: an older one and the latest one.
const freshIds = fresh.filter((f) => !f.s.lane).map((f) => f.iid);
const libIds = fresh.filter((f) => f.s.lane === "library").map((f) => f.iid);
d.prepare("INSERT INTO digests(created_at,item_ids,intro) VALUES(?,?,?)").run(hoursAgo(50), JSON.stringify(freshIds.slice(8, 14)), null);
d.prepare("INSERT INTO digests(created_at,item_ids,intro) VALUES(?,?,?)").run(
  hoursAgo(2),
  JSON.stringify([...freshIds.filter((x) => x !== pick("spreadsheets")), ...libIds.slice(0, 3)]),
  "A strong two days for agent harnesses: a sandbox escape from Project Zero and a paper that drops text from tool results entirely. If you only read one thing, make it the robot-learning primer."
);

d.prepare("INSERT INTO runs(kind,started_at,finished_at,stats,error) VALUES(?,?,?,?,?)").run(
  "pipeline", hoursAgo(2.2), hoursAgo(2), JSON.stringify({ collected: 412, scored: 61 }), null
);

console.log(`Seeded ${SEEDS.length + 1} items into ${process.env.RADAR_DB}`);

import { TOPICS } from "@config/topics";
import { db } from "@/lib/db";
import { log, chunk, sleep } from "@/lib/util";
import type { Candidate } from "./types";

// X via twitterapi.io (pay-per-result, ~$0.15 / 1k tweets). Set TWITTERAPI_IO_KEY in .env.local.
// There is deliberately no hand-made list of people: we search by topic, then every author is
// vetted by background (professor / researcher / fundamental builder / OSS hacker vs.
// commentator / hype). People who pass are remembered and swept directly on later runs, so
// the "list" grows itself from the quality of their work.

type Tweet = {
  id: string;
  url: string;
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount?: number;
  bookmarkCount?: number;
  createdAt: string;
  lang?: string;
  isReply?: boolean;
  entities?: { urls?: { expanded_url?: string }[] };
  quoted_tweet?: Tweet | null;
  author: { userName: string; name: string; description?: string; followers?: number; profile_bio?: { description?: string } };
};

const API = "https://api.twitterapi.io/twitter/tweet/advanced_search";

// twitterapi.io rate-limits new/low-balance accounts to ~1 request per 5s. Requests are made
// one at a time with a gap, and a 429 waits and retries instead of dropping the query.
const GAP_MS = Number(process.env.RADAR_X_GAP_MS ?? 5200);
let lastCall = 0;

async function call(url: string, key: string): Promise<{ tweets: Tweet[]; has_next_page: boolean; next_cursor: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(url, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(30000) });
    if (res.status === 429) {
      await sleep(GAP_MS * (attempt + 2));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error("rate-limited (429) after retries");
}

async function search(query: string, queryType: "Top" | "Latest", pages = 1): Promise<Tweet[]> {
  const key = process.env.TWITTERAPI_IO_KEY!;
  const out: Tweet[] = [];
  let cursor = "";
  for (let p = 0; p < pages; p++) {
    const qs = new URLSearchParams({ query, queryType, cursor });
    const res = await call(`${API}?${qs}`, key);
    out.push(...(res.tweets ?? []));
    if (!res.has_next_page) break;
    cursor = res.next_cursor;
  }
  return out;
}

function firstLink(t: Tweet): string | null {
  const urls = [...(t.entities?.urls ?? []), ...(t.quoted_tweet?.entities?.urls ?? [])]
    .map((u) => u.expanded_url)
    .filter((u): u is string => !!u && !/^https?:\/\/(x|twitter)\.com\//.test(u) && !/t\.co\//.test(u));
  return urls[0] ?? null;
}

function toCandidate(t: Tweet): Candidate {
  const link = firstLink(t);
  const handle = t.author.userName;
  const tweetUrl = t.url || `https://x.com/${handle}/status/${t.id}`;
  return {
    url: link ?? tweetUrl,
    title: link ? t.text.replace(/https?:\/\/\S+/g, "").trim().slice(0, 200) || link : t.text.slice(0, 200),
    excerpt: t.text.slice(0, 1500),
    published_at: new Date(t.createdAt).toISOString(),
    mention: {
      source: "x",
      source_id: t.id,
      discuss_url: tweetUrl,
      author: handle,
      text: t.text,
      engagement: { likes: t.likeCount, retweets: t.retweetCount, comments: t.replyCount, views: t.viewCount },
      created_at: new Date(t.createdAt).toISOString(),
    },
    author: {
      key: `x:${handle}`,
      name: t.author.name,
      bio: t.author.description || t.author.profile_bio?.description,
      followers: t.author.followers,
    },
  };
}

export async function collectX(hours = 48): Promise<Candidate[]> {
  if (!process.env.TWITTERAPI_IO_KEY) {
    log("x", "skipped — TWITTERAPI_IO_KEY not set");
    return [];
  }
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const out: Candidate[] = [];

  // 1) Topic discovery: popular original posts per topic.
  const queries = TOPICS.flatMap((t) => t.x.map((q) => `${q} lang:en -filter:replies -filter:retweets min_faves:25 since_time:${since}`));
  for (const q of queries) {
    try {
      for (const t of await search(q, "Top", 2)) out.push(toCandidate(t));
    } catch (e) {
      log("x", `query failed: ${(e as Error).message}`);
    }
  }

  // 2) Sweep people who already passed vetting (or you marked Trusted).
  const trusted = db()
    .prepare("SELECT key FROM authors WHERE key LIKE 'x:%' AND override IS NOT 'block' AND (override = 'trust' OR trust >= 0.7) ORDER BY trust DESC LIMIT 300")
    .all() as { key: string }[];
  const groups = chunk(trusted.map((a) => a.key.slice(2)), 12);
  for (const handles of groups) {
    const q = `(${handles.map((h) => `from:${h}`).join(" OR ")}) -filter:replies since_time:${since}`;
    try {
      for (const t of await search(q, "Latest", 1)) out.push(toCandidate(t));
    } catch (e) {
      log("x", `sweep failed: ${(e as Error).message}`);
    }
  }
  log("x", `${queries.length} topic searches + ${groups.length} sweeps of ${trusted.length} vetted people`);
  return out;
}

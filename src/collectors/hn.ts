import { TOPICS } from "@config/topics";
import { fetchJson, stripHtml, log, mapLimit } from "@/lib/util";
import type { Candidate } from "./types";

type Hit = {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_text?: string | null;
};

const API = "https://hn.algolia.com/api/v1";

function toCandidate(h: Hit, lane: "fresh" | "library"): Candidate | null {
  if (!h.title) return null;
  const thread = `https://news.ycombinator.com/item?id=${h.objectID}`;
  return {
    url: h.url || thread,
    title: h.title,
    excerpt: h.story_text ? stripHtml(h.story_text, 1200) : undefined,
    published_at: h.created_at,
    lane,
    mention: {
      source: "hn",
      source_id: h.objectID,
      discuss_url: thread,
      author: h.author,
      text: h.title,
      engagement: { points: h.points ?? 0, comments: h.num_comments ?? 0 },
      created_at: h.created_at,
    },
  };
}

async function search(params: Record<string, string>, endpoint: "search" | "search_by_date" = "search"): Promise<Hit[]> {
  const qs = new URLSearchParams({ tags: "story", hitsPerPage: "40", ...params });
  const res = await fetchJson<{ hits: Hit[] }>(`${API}/${endpoint}?${qs}`);
  return res.hits;
}

/** Fresh lane: what's big on HN overall + what's moving in each of your topics. */
export async function collectHN(days = 3): Promise<Candidate[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const out: Candidate[] = [];

  // 1) Broadly popular stories (the judge will drop what's off-topic).
  const popular = await search({ numericFilters: `created_at_i>${since},points>120`, hitsPerPage: "100" }, "search_by_date");
  for (const h of popular) {
    const c = toCandidate(h, "fresh");
    if (c) out.push(c);
  }

  // 2) Per-topic searches with a lower bar — niche topics rarely hit the front page.
  const terms = [...new Set(TOPICS.flatMap((t) => t.hn))];
  await mapLimit(terms, 4, async (q) => {
    try {
      const hits = await search({ query: q, numericFilters: `created_at_i>${since},points>15` });
      for (const h of hits) {
        const c = toCandidate(h, "fresh");
        if (c) out.push(c);
      }
    } catch (e) {
      log("hn", `query "${q}" failed: ${(e as Error).message}`);
    }
  });
  return out;
}

/** Library lane: the all-time most-loved HN stories for each topic (Karpathy-style "staying power"). */
export async function collectHNLibrary(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const queries = [
    ...TOPICS.flatMap((t) => t.hn.filter((q) => q !== "Ask HN")),
    "how to learn", "fundamentals explained", "from first principles", "a visual introduction", "lecture notes",
  ];
  await mapLimit([...new Set(queries)], 4, async (q) => {
    try {
      const hits = await search({ query: q, numericFilters: "points>250", hitsPerPage: "30" });
      for (const h of hits) {
        const c = toCandidate(h, "library");
        if (c) out.push(c);
      }
    } catch (e) {
      log("hn-library", `query "${q}" failed: ${(e as Error).message}`);
    }
  });
  return out;
}

export type HNComment = { author: string; text: string };

/** All comments in a thread (flattened), for endorsement labelling. */
export async function fetchHNComments(id: string): Promise<HNComment[]> {
  type Node = { author: string | null; text: string | null; children?: Node[] };
  const root = await fetchJson<Node>(`${API}/items/${id}`, { timeoutMs: 30000 });
  const out: HNComment[] = [];
  const walk = (n: Node, depth: number) => {
    for (const c of n.children ?? []) {
      if (c.author && c.text) out.push({ author: c.author, text: stripHtml(c.text, 700) });
      if (depth < 3) walk(c, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

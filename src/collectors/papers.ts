import { XMLParser } from "fast-xml-parser";
import { TOPICS } from "@config/topics";
import { fetchJson, fetchText, sleep, log, stripHtml } from "@/lib/util";
import type { Candidate } from "./types";

/** Hugging Face Daily Papers: new papers ranked by community upvotes. */
export async function collectHF(days = 3): Promise<Candidate[]> {
  type P = {
    paper: { id: string; title: string; summary: string; upvotes: number; publishedAt: string; githubRepo?: string; githubStars?: number; authors?: { name: string }[] };
    numComments?: number;
    publishedAt: string;
  };
  const out: Candidate[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
    try {
      const list = await fetchJson<P[]>(`https://huggingface.co/api/daily_papers?date=${date}&limit=100`);
      for (const p of list) {
        const authors = (p.paper.authors ?? []).slice(0, 6).map((a) => a.name).join(", ");
        out.push({
          url: `https://arxiv.org/abs/${p.paper.id}`,
          title: p.paper.title,
          excerpt: `${authors ? `Authors: ${authors}. ` : ""}${p.paper.summary}`.slice(0, 1500),
          published_at: p.paper.publishedAt,
          mention: {
            source: "hf",
            source_id: p.paper.id,
            discuss_url: `https://huggingface.co/papers/${p.paper.id}`,
            text: p.paper.title,
            engagement: { upvotes: p.paper.upvotes, comments: p.numComments ?? 0, stars: p.paper.githubStars },
            created_at: p.publishedAt,
          },
        });
      }
    } catch (e) {
      log("hf", `${date}: ${(e as Error).message}`);
    }
  }
  return out;
}

/** Raw arXiv for the smaller fields (robotics, astro, security, PL, networking). */
export async function collectArxiv(days = 5, perCat = 100): Promise<Candidate[]> {
  const cats = [...new Set(TOPICS.flatMap((t) => t.arxiv ?? []))];
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const cutoff = Date.now() - days * 86400_000;
  const out: Candidate[] = [];
  for (const cat of cats) {
    try {
      const xml = await fetchText(
        `https://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=${perCat}`,
        { timeoutMs: 30000 }
      );
      const feed = parser.parse(xml).feed;
      const entries = feed?.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
      for (const e of entries) {
        if (new Date(e.published).getTime() < cutoff) continue;
        const id = String(e.id).replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
        const authors = (Array.isArray(e.author) ? e.author : [e.author]).slice(0, 6).map((a: { name: string }) => a?.name).join(", ");
        out.push({
          url: `https://arxiv.org/abs/${id}`,
          title: String(e.title).replace(/\s+/g, " ").trim(),
          excerpt: `Authors: ${authors}. ${stripHtml(String(e.summary), 1400)}`,
          published_at: e.published,
          mention: { source: "arxiv", source_id: id, discuss_url: `https://arxiv.org/abs/${id}`, text: cat, created_at: e.published },
        });
      }
    } catch (e) {
      log("arxiv", `${cat}: ${(e as Error).message}`);
    }
    await sleep(3200); // arXiv asks for ~3s between API calls
  }
  return out;
}

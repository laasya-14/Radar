import { XMLParser } from "fast-xml-parser";
import { FEEDS } from "@config/feeds";
import { fetchText, stripHtml, log, mapLimit } from "@/lib/util";
import type { Candidate } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) return String((v as Record<string, unknown>)["#text"]);
  return "";
};
const arr = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function atomLink(links: unknown): string {
  const ls = arr(links as Record<string, string>[]);
  const alt = ls.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? ls[0];
  return alt?.["@_href"] ?? text(alt);
}

/** Recent posts from the starter blogs in config/feeds.ts. */
export async function collectRSS(days = Number(process.env.RADAR_RSS_DAYS ?? 5)): Promise<Candidate[]> {
  const cutoff = Date.now() - days * 86400_000;
  const out: Candidate[] = [];
  await mapLimit(FEEDS, 6, async (feed) => {
    try {
      const xml = await fetchText(feed.url, { timeoutMs: 20000, retries: 1 });
      const doc = parser.parse(xml);
      const entries: { title: string; link: string; date: string; body: string; id: string }[] = [];
      if (doc.rss) {
        for (const it of arr(doc.rss.channel?.item)) {
          entries.push({
            title: text(it.title),
            link: text(it.link),
            date: text(it.pubDate) || text(it["dc:date"]),
            body: text(it["content:encoded"]) || text(it.description),
            id: text(it.guid) || text(it.link),
          });
        }
      } else if (doc.feed) {
        for (const it of arr(doc.feed.entry)) {
          entries.push({
            title: text(it.title),
            link: atomLink(it.link),
            date: text(it.published) || text(it.updated),
            body: text(it.content) || text(it.summary),
            id: text(it.id) || atomLink(it.link),
          });
        }
      }
      for (const e of entries) {
        const t = new Date(e.date).getTime();
        if (!e.link || !e.title || !Number.isFinite(t) || t < cutoff) continue;
        out.push({
          url: e.link,
          title: stripHtml(e.title, 300),
          excerpt: stripHtml(e.body, 1500),
          published_at: new Date(t).toISOString(),
          mention: {
            source: "rss",
            source_id: `${feed.url}#${e.id}`,
            discuss_url: e.link,
            author: feed.name,
            text: `Feed: ${feed.name} (topics: ${feed.topics.join(", ")})`,
            created_at: new Date(t).toISOString(),
          },
        });
      }
    } catch (e) {
      log("rss", `${feed.name}: ${(e as Error).message}`);
    }
  });
  return out;
}

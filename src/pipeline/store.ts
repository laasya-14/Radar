import { db, now } from "@/lib/db";
import { canonicalUrl, itemIdFor, domainOf, cleanTitle } from "@/lib/util";
import type { Candidate } from "@/collectors/types";

/** Insert/merge candidates. Same canonical URL from different sources => one item, many mentions. */
export function storeCandidates(cands: Candidate[]): { newItems: number; newMentions: number } {
  const d = db();
  const insItem = d.prepare(
    `INSERT INTO items(id, url, canonical_url, title, excerpt, domain, lane, published_at, first_seen)
     VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`
  );
  const upExcerpt = d.prepare(
    `UPDATE items SET excerpt = ? WHERE id = ? AND (excerpt IS NULL OR length(excerpt) < length(?))`
  );
  // A paper/link found in the fresh stream should be treated as fresh even if it's also in the library.
  const promoteFresh = d.prepare(`UPDATE items SET lane = 'fresh' WHERE id = ? AND ? = 'fresh'`);
  const insMention = d.prepare(
    `INSERT INTO mentions(item_id, source, source_id, discuss_url, author, text, engagement, created_at)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(source, source_id) DO UPDATE SET engagement = excluded.engagement`
  );
  const upAuthor = d.prepare(
    `INSERT INTO authors(key, name, bio, followers, seen_count) VALUES(?,?,?,?,1)
     ON CONFLICT(key) DO UPDATE SET name=excluded.name, bio=COALESCE(excluded.bio, authors.bio),
       followers=COALESCE(excluded.followers, authors.followers), seen_count = authors.seen_count + 1`
  );

  let newItems = 0;
  let newMentions = 0;
  d.exec("BEGIN");
  try {
    for (const c of cands) {
      const canonical = canonicalUrl(c.url);
      const id = itemIdFor(canonical);
      const r = insItem.run(id, c.url, canonical, cleanTitle(c.title), c.excerpt ?? null, domainOf(c.url), c.lane ?? "fresh", c.published_at ?? null, now());
      if (r.changes) newItems++;
      else {
        if (c.excerpt) upExcerpt.run(c.excerpt, id, c.excerpt);
        promoteFresh.run(id, c.lane ?? "fresh");
      }
      const m = c.mention;
      const before = d.prepare("SELECT 1 FROM mentions WHERE source=? AND source_id=?").get(m.source, m.source_id);
      insMention.run(id, m.source, m.source_id, m.discuss_url ?? null, m.author ?? null, m.text ?? null, m.engagement ? JSON.stringify(m.engagement) : null, m.created_at ?? null);
      if (!before) newMentions++;
      if (c.author) upAuthor.run(c.author.key, c.author.name ?? null, c.author.bio ?? null, c.author.followers ?? null);
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return { newItems, newMentions };
}

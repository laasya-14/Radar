import Link from "next/link";
import type { ReactNode } from "react";
import { getItems } from "@/lib/db";
import { TOPICS } from "@config/topics";
import { ItemList } from "@/components/ItemList";
import JobButton from "@/components/JobButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

type SP = { topic?: string; source?: string; kind?: string; status?: string; sort?: string };

const SOURCES = [
  { id: "hn", label: "Hacker News" },
  { id: "x", label: "X" },
  { id: "hf", label: "HF Papers" },
  { id: "arxiv", label: "arXiv" },
  { id: "github", label: "GitHub" },
  { id: "rss", label: "Blogs" },
];
const KINDS = ["paper", "essay", "repo", "thread", "talk", "tool", "news"];
const STATUSES = [
  { id: "unseen", label: "Unrated" },
  { id: "liked", label: "Liked" },
  { id: "disliked", label: "Not for me" },
];

export default async function FeedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: string[] = ["i.lane = 'fresh'"];
  const params: (string | number)[] = [];

  if (sp.topic) {
    where.push("s.topic = ?");
    params.push(sp.topic);
  }
  if (sp.source) {
    where.push("EXISTS (SELECT 1 FROM mentions m WHERE m.item_id = i.id AND m.source = ?)");
    params.push(sp.source);
  }
  if (sp.kind) {
    where.push("s.kind = ?");
    params.push(sp.kind);
  }
  if (sp.status === "unseen") where.push("COALESCE(st.rating,0) = 0");
  else if (sp.status === "liked") where.push("st.rating = 1");
  else if (sp.status === "disliked") where.push("st.rating = -1");
  else where.push("COALESCE(st.rating,0) != -1");

  const items = getItems({
    where: where.join(" AND "),
    params,
    order: sp.sort === "new" ? "COALESCE(i.published_at, i.first_seen) DESC" : "s.final DESC",
    limit: 150,
  });

  const href = (patch: Partial<SP>) => {
    const next = { ...sp, ...patch };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/feed?${s}` : "/feed";
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Feed</h1>
        <p className="page-sub">Everything worth a look, best first. Your ratings teach Radar what you like.</p>
      </header>

      <div className="filters">
        <FilterRow label="Topic">
          <F href={href({ topic: undefined })} on={!sp.topic}>All</F>
          {TOPICS.map((t) => (
            <F key={t.id} href={href({ topic: t.id })} on={sp.topic === t.id}>
              <Icon name={t.id} /> {t.name}
            </F>
          ))}
        </FilterRow>
        <FilterRow label="Source">
          <F href={href({ source: undefined })} on={!sp.source}>All</F>
          {SOURCES.map((s) => (
            <F key={s.id} href={href({ source: s.id })} on={sp.source === s.id}>
              {s.label}
            </F>
          ))}
        </FilterRow>
        <FilterRow label="Kind">
          <F href={href({ kind: undefined })} on={!sp.kind}>All</F>
          {KINDS.map((k) => (
            <F key={k} href={href({ kind: k })} on={sp.kind === k}>
              {k}
            </F>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          <F href={href({ status: undefined })} on={!sp.status}>Hide disliked</F>
          {STATUSES.map((s) => (
            <F key={s.id} href={href({ status: s.id })} on={sp.status === s.id}>
              {s.label}
            </F>
          ))}
        </FilterRow>
        <FilterRow label="Sort">
          <F href={href({ sort: undefined })} on={sp.sort !== "new"}>Best</F>
          <F href={href({ sort: "new" })} on={sp.sort === "new"}>Newest</F>
        </FilterRow>
      </div>

      <p className="result-count">{items.length} items</p>
      {items.length ? (
        <ItemList items={items} />
      ) : (
        <div className="empty">
          <p className="empty-title">Nothing here.</p>
          <p>Try fewer filters, or look for new things.</p>
          <p className="empty-actions"><JobButton kind="pipeline" label="Find new things" /></p>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-chips">{children}</div>
    </div>
  );
}

function F({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={`fchip${on ? " on" : ""}`} aria-current={on ? "true" : undefined} scroll={false}>
      {children}
    </Link>
  );
}

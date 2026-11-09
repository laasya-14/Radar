import Link from "next/link";
import { getItemsByIds, latestDigest } from "@/lib/db";
import { getDigest, listDigests } from "@/lib/queries";
import { formatDate, timeAgo } from "@/lib/format";
import { GroupedByTopic, ItemList } from "@/components/ItemList";
import JobButton from "@/components/JobButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function DigestPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const requested = d ? getDigest(Number(d)) : null;
  const digest = requested ?? latestDigest();
  const all = listDigests(20);

  if (!digest) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Digest</h1>
        </header>
        <div className="empty">
          <p className="empty-title">No digest yet.</p>
          <p>A new digest comes every two days. To make one now:</p>
          <p className="empty-actions">
            <JobButton kind="pipeline" label="Find new things" />
            <JobButton kind="digest" label="Make a digest" className="btn btn-ghost" />
          </p>
        </div>
      </div>
    );
  }

  const ids = JSON.parse(digest.item_ids) as string[];
  const items = getItemsByIds(ids);
  const fresh = items.filter((i) => i.lane !== "library");
  const library = items.filter((i) => i.lane === "library");
  const isLatest = digest.id === all[0]?.id;

  return (
    <div className="page">
      <header className="page-head">
        {!isLatest && <p className="eyebrow">Earlier digest</p>}
        <h1>{formatDate(digest.created_at)}</h1>
        <p className="page-sub">
          {items.length} things to explore · built {timeAgo(digest.created_at)}
        </p>
        {all.length > 1 && (
          <details className="digest-picker">
            <summary>Other digests</summary>
            <ul>
              {all.map((g) => (
                <li key={g.id}>
                  <Link href={g.id === all[0].id ? "/" : `/?d=${g.id}`} className={g.id === digest.id ? "active" : undefined}>
                    {formatDate(g.created_at)} <span className="muted">· {g.n} items</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </header>

      {digest.intro && <p className="intro">{digest.intro}</p>}

      <GroupedByTopic items={fresh} />

      {library.length > 0 && (
        <section className="group group-library">
          <h2 className="group-title">
            <Icon name="library" className="icon icon-heading" /> From the library
            <span className="group-count">{library.length}</span>
          </h2>
          <p className="group-note">Older favourites that many people still recommend.</p>
          <ItemList items={library} />
        </section>
      )}
    </div>
  );
}

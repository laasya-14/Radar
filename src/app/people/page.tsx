import Link from "next/link";
import { authorCounts, listAuthors } from "@/lib/queries";
import { compact } from "@/lib/format";
import AuthorActions from "@/components/AuthorActions";
import XKeyForm from "@/components/XKeyForm";
import { TIER_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "trusted", label: "Kept" },
  { id: "rejected", label: "Skipped" },
  { id: "all", label: "All" },
] as const;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = (TABS.find((x) => x.id === t)?.id ?? "trusted") as "trusted" | "rejected" | "all";
  const counts = authorCounts();
  const authors = counts.total ? listAuthors(tab) : [];

  return (
    <div className="page page-wide">
      <header className="page-head">
        <h1>People</h1>
        <p className="page-sub">
          People Radar found on X. It keeps researchers, professors, builders and open-source developers, and skips
          commentators and people selling things. You can change any of its calls.
        </p>
        {counts.total > 0 && <XKeyForm />}
      </header>

      {counts.total === 0 ? (
        <div className="empty">
          <p className="empty-title">No one here yet.</p>
          <p>Connect X and Radar will start finding people worth following.</p>
          <XKeyForm />
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {TABS.map((x) => (
              <Link
                key={x.id}
                href={x.id === "trusted" ? "/people" : `/people?tab=${x.id}`}
                className={tab === x.id ? "on" : undefined}
                role="tab"
                aria-selected={tab === x.id}
              >
                {x.label}
                {x.id === "trusted" && <span className="tab-count">{counts.trusted ?? 0}</span>}
                {x.id === "all" && <span className="tab-count">{counts.total}</span>}
              </Link>
            ))}
          </div>

          {authors.length === 0 ? (
            <p className="muted">Nobody in this group.</p>
          ) : (
            <div className="people">
              {authors.map((a) => {
                const handle = a.key.replace(/^x:/, "");
                const trusted = a.override === "trust" || (a.override == null && (a.trust ?? 0) >= 0.6);
                return (
                  <div key={a.key} className={`person${trusted ? "" : " person-rejected"}`}>
                    <div className="person-main">
                      <div className="person-head">
                        <span className="person-name">{a.name ?? handle}</span>
                        <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" className="handle">
                          @{handle}
                        </a>
                        {a.tier && <span className={`chip tier-${a.tier}`}>{TIER_LABEL[a.tier] ?? a.tier}</span>}
                        {a.override && <span className="chip chip-quiet">you: {a.override}</span>}
                      </div>
                      {a.bio && <p className="person-bio">{a.bio}</p>}
                      {a.reason && <p className="person-reason">{a.reason}</p>}
                      <p className="person-stats">
                        trust <b>{a.trust == null ? "–" : a.trust.toFixed(2)}</b> · {compact(a.followers)} followers · seen{" "}
                        {a.seen_count}×
                      </p>
                    </div>
                    <AuthorActions authorKey={a.key} override={a.override} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

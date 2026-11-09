import { getItems } from "@/lib/db";
import { GroupedByTopic } from "@/components/ItemList";
import JobButton from "@/components/JobButton";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const items = getItems({ where: "i.lane = 'library' AND COALESCE(st.rating,0) != -1", limit: 400 });
  return (
    <div className="page">
      <header className="page-head">
        <h1>Library</h1>
        <p className="page-sub">
          The best older work in your topics: things many people have recommended for years.
        </p>
      </header>
      {items.length ? (
        <GroupedByTopic items={items} />
      ) : (
        <div className="empty">
          <p className="empty-title">The library is empty.</p>
          <p>Radar looks through years of Hacker News for things people kept recommending.</p>
          <p className="empty-actions">
            <JobButton kind="library" label="Build the library" />
          </p>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { getItems } from "@/lib/db";
import { ItemList } from "@/components/ItemList";

export const dynamic = "force-dynamic";

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const done = tab === "explored";
  const items = getItems({
    where: done ? "st.explored = 1" : "st.saved = 1 AND COALESCE(st.explored,0) = 0",
    order: "st.updated_at DESC",
    limit: 300,
  });
  return (
    <div className="page">
      <header className="page-head">
        <h1>Saved</h1>
        <p className="page-sub">Things you saved for later. Tick them off when you’re done.</p>
      </header>
      <div className="tabs" role="tablist">
        <Link href="/saved" className={!done ? "on" : undefined} role="tab" aria-selected={!done}>
          To do
        </Link>
        <Link href="/saved?tab=explored" className={done ? "on" : undefined} role="tab" aria-selected={done}>
          Done
        </Link>
      </div>
      {items.length ? (
        <ItemList items={items} />
      ) : (
        <div className="empty">
          <p className="empty-title">{done ? "Nothing done yet." : "Nothing saved yet."}</p>
          <p>{done ? "Press ✓ (or e) when you’re done with something." : "Press ☆ (or s) to save something for later."}</p>
        </div>
      )}
    </div>
  );
}

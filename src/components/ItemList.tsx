import type { FeedItem } from "@/lib/db";
import { TOPICS } from "@config/topics";
import ItemCard from "./ItemCard";
import Icon from "@/components/Icon";

// node:sqlite returns null-prototype rows, which React refuses to pass to client components.
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function ItemList({ items, showTopic = true }: { items: FeedItem[]; showTopic?: boolean }) {
  return (
    <div className="list">
      {plain(items).map((it) => (
        <ItemCard key={it.id} item={it} showTopic={showTopic} />
      ))}
    </div>
  );
}

/** Items grouped under topic headers, in TOPICS order (unknown topics last). */
export function GroupedByTopic({ items }: { items: FeedItem[] }) {
  const groups = new Map<string, FeedItem[]>();
  for (const it of items) {
    const k = it.topic ?? "other";
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const order = [...TOPICS.map((t) => t.id), ...[...groups.keys()].filter((k) => !TOPICS.some((t) => t.id === k))];
  return (
    <>
      {order
        .filter((k) => groups.has(k))
        .map((k) => {
          const t = TOPICS.find((x) => x.id === k);
          return (
            <section key={k} className="group">
              <h2 className="group-title">
                <Icon name={t?.id ?? "other"} className="icon icon-heading" /> {t?.name ?? "Other"}
                <span className="group-count">{groups.get(k)!.length}</span>
              </h2>
              <ItemList items={groups.get(k)!} showTopic={false} />
            </section>
          );
        })}
    </>
  );
}

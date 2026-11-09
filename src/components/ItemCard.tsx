"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { FeedItem, MentionRow, Engagement } from "@/lib/db";
import { TOPIC_BY_ID } from "@config/topics";
import { compact, timeAgo, DISLIKE_REASONS, TOPIC_HUES, TRUSTED_TIERS, TIER_LABEL } from "@/lib/format";
import Icon from "@/components/Icon";

type Props = { item: FeedItem; showTopic?: boolean };

type State = {
  rating: number;
  saved: number;
  explored: number;
  reasons: string[];
  note: string;
};

function parseReasons(r: string | null): string[] {
  if (!r) return [];
  try {
    const v = JSON.parse(r);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function send(itemId: string, action: string, extra?: { reasons?: string[]; note?: string }) {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemId, action, ...extra }),
  });
  if (!res.ok) throw new Error(`feedback failed: ${res.status}`);
}

export default function ItemCard({ item, showTopic = true }: Props) {
  const [s, setS] = useState<State>({
    rating: item.rating,
    saved: item.saved,
    explored: item.explored,
    reasons: parseReasons(item.reasons),
    note: item.note ?? "",
  });
  const [picker, setPicker] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  // Optimistic update with rollback on failure.
  const act = useCallback(
    async (action: string, patch: Partial<State>, extra?: { reasons?: string[]; note?: string }) => {
      const prev = s;
      setS({ ...s, ...patch });
      setError(null);
      try {
        await send(item.id, action, extra);
      } catch {
        setS(prev);
        setError("Couldn't save — try again.");
      }
    },
    [s, item.id]
  );

  const like = useCallback(() => {
    setPicker(false);
    if (s.rating === 1) act("clear", { rating: 0, reasons: [] });
    else act("like", { rating: 1, reasons: [] });
  }, [s.rating, act]);

  const dislike = useCallback(() => {
    if (s.rating === -1) {
      setPicker(false);
      act("clear", { rating: 0, reasons: [] });
    } else {
      setPicker(true);
      act("dislike", { rating: -1 });
    }
  }, [s.rating, act]);

  const save = useCallback(() => act(s.saved ? "unsave" : "save", { saved: s.saved ? 0 : 1 }), [s.saved, act]);
  const explored = useCallback(
    () => act(s.explored ? "unexplored" : "explored", { explored: s.explored ? 0 : 1 }),
    [s.explored, act]
  );
  const open = useCallback(() => {
    send(item.id, "open").catch(() => {});
  }, [item.id]);

  // Commands dispatched by KeyboardNav on the focused card.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onCmd = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (cmd === "like") like();
      else if (cmd === "dislike") dislike();
      else if (cmd === "save") save();
      else if (cmd === "explored") explored();
      else if (cmd === "open") {
        open();
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    };
    el.addEventListener("radar-cmd", onCmd);
    return () => el.removeEventListener("radar-cmd", onCmd);
  }, [like, dislike, save, explored, open, item.url]);

  const toggleReason = (id: string) => {
    const reasons = s.reasons.includes(id) ? s.reasons.filter((r) => r !== id) : [...s.reasons, id];
    act("dislike", { reasons }, { reasons });
  };

  const saveNote = (note: string) => {
    act("note", { note }, { note });
    setNoteOpen(false);
  };

  const topic = item.topic ? TOPIC_BY_ID[item.topic] : null;
  const hue = item.topic ? (TOPIC_HUES[item.topic] ?? 220) : 220;
  const published = item.published_at ?? item.first_seen;

  return (
    <article
      ref={rootRef}
      data-card
      tabIndex={-1}
      className={`card${s.rating === -1 ? " is-disliked" : ""}${s.explored ? " is-explored" : ""}`}
      style={{ ["--hue" as string]: hue }}
    >
      <div className="card-meta">
        {showTopic && topic && (
          <span className="chip chip-topic">
            <Icon name={topic.id} /> {topic.name}
          </span>
        )}
        {item.kind && <span className="chip">{item.kind}</span>}
        {item.level && <span className="chip chip-quiet">{item.level}</span>}
        {item.lane === "library" && <span className="chip chip-quiet">library</span>}
        <span className="spacer" />
        {item.read_minutes ? <span className="meta-text">{item.read_minutes} min</span> : null}
        <ScorePill item={item} />
      </div>

      <h3 className="card-title">
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={open}>
          {item.title}
        </a>
      </h3>
      <div className="card-sub">
        {item.domain && <span>{item.domain}</span>}
        {published && <span>{timeAgo(published)}</span>}
      </div>

      {item.why && (
        <p className="why">{item.why}</p>
      )}
      {item.takeaway && <p className="takeaway">{item.takeaway}</p>}

      {item.endorse_count && item.endorse_count > 0 ? (
        <figure className="endorse">
          <figcaption>
            {item.endorse_count} {item.endorse_count === 1 ? "person recommends" : "people recommend"} this
          </figcaption>
          {item.endorse_quote && (
            <blockquote>
              “{item.endorse_quote}”{item.endorse_by && <cite> — {item.endorse_by}</cite>}
            </blockquote>
          )}
        </figure>
      ) : null}

      <SourceBadges mentions={item.mentions} url={item.url} />

      <div className="actions">
        <button
          className={`act${s.rating === 1 ? " on" : ""}`}
          onClick={like}
          title="More like this (l)"
          aria-label="More like this"
          aria-pressed={s.rating === 1}
        >
          <Icon name="up" filled={s.rating === 1} />
        </button>
        <button
          className={`act${s.rating === -1 ? " on on-neg" : ""}`}
          onClick={dislike}
          title="Not for me (d)"
          aria-label="Not for me"
          aria-pressed={s.rating === -1}
        >
          <Icon name="down" filled={s.rating === -1} />
        </button>
        <button className={`act${s.saved ? " on" : ""}`} onClick={save} title={s.saved ? "Saved (s)" : "Save (s)"} aria-label={s.saved ? "Saved" : "Save"} aria-pressed={!!s.saved}>
          <Icon name="star" filled={!!s.saved} />
        </button>
        <button
          className={`act${s.explored ? " on" : ""}`}
          onClick={explored}
          title={s.explored ? "Done (e)" : "Mark as done (e)"}
          aria-label={s.explored ? "Done" : "Mark as done"}
          aria-pressed={!!s.explored}
        >
          <Icon name="check" />
        </button>
        <button className={`act${s.note ? " on" : ""}`} onClick={() => setNoteOpen((v) => !v)} title="Note" aria-label="Note">
          <Icon name="note" />
        </button>
      </div>

      {picker && s.rating === -1 && (
        <div className="picker" role="group" aria-label="Why not?">
          <span className="picker-label">Why?</span>
          <div className="picker-chips">
            {DISLIKE_REASONS.map((r) => (
              <button
                key={r.id}
                className={`pchip${s.reasons.includes(r.id) ? " on" : ""}`}
                onClick={() => toggleReason(r.id)}
                aria-pressed={s.reasons.includes(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <NoteInput
            initial={s.note}
            placeholder="Anything else? (optional)"
            onSave={(note) => {
              act("dislike", { note }, { reasons: s.reasons, note });
              setPicker(false);
            }}
            onCancel={() => setPicker(false)}
            saveLabel="Done"
          />
        </div>
      )}

      {noteOpen && (
        <div className="picker">
          <NoteInput initial={s.note} placeholder="A note for yourself or for Radar…" onSave={saveNote} onCancel={() => setNoteOpen(false)} />
        </div>
      )}
      {!noteOpen && !picker && s.note && <p className="note">✎ {s.note}</p>}
      {error && <p className="error">{error}</p>}
    </article>
  );
}

function NoteInput({
  initial,
  placeholder,
  onSave,
  onCancel,
  saveLabel = "Save note",
}: {
  initial: string;
  placeholder: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [v, setV] = useState(initial);
  return (
    <form
      className="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v.trim());
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      />
      <button type="submit" className="btn btn-small">
        {saveLabel}
      </button>
    </form>
  );
}

function ScorePill({ item }: { item: FeedItem }) {
  if (item.final == null) return null;
  const rows: [string, number | null][] = [
    ["Novelty", item.novelty],
    ["Depth", item.depth],
    ["Learning", item.learning],
    ["Fit", item.fit],
  ];
  return (
    <span className="score" tabIndex={0} aria-label={`Score ${item.final.toFixed(1)}`}>
      {item.final.toFixed(1)}
      <span className="score-pop" role="tooltip">
        {rows.map(([k, v]) => (
          <span key={k} className="score-row">
            <span>{k}</span>
            <span className="score-bar">
              <span style={{ width: `${Math.max(0, Math.min(10, v ?? 0)) * 10}%` }} />
            </span>
            <span className="score-num">{v == null ? "–" : v.toFixed(0)}</span>
          </span>
        ))}
        <span className="score-row score-final">
          <span>Final</span>
          <span />
          <span className="score-num">{item.final.toFixed(1)}</span>
        </span>
      </span>
    </span>
  );
}

function eng(m: MentionRow): Engagement {
  if (!m.engagement) return {};
  try {
    return JSON.parse(m.engagement) as Engagement;
  } catch {
    return {};
  }
}

function SourceBadges({ mentions, url }: { mentions: MentionRow[]; url: string }) {
  if (mentions.length === 0) return null;
  const badges: ReactNode[] = [];

  const hn = mentions.filter((m) => m.source === "hn");
  if (hn.length) {
    const best = hn.reduce((a, b) => ((eng(b).points ?? 0) > (eng(a).points ?? 0) ? b : a));
    const e = eng(best);
    badges.push(
      <a key="hn" className="badge badge-hn" href={best.discuss_url ?? url} target="_blank" rel="noopener noreferrer">
        <b>HN</b> {compact(e.points)} pts · {compact(e.comments)} comments
      </a>
    );
  }

  const x = mentions.filter((m) => m.source === "x");
  if (x.length) {
    const byAuthor = new Map<string, MentionRow>();
    for (const m of x) if (m.author && !byAuthor.has(m.author)) byAuthor.set(m.author, m);
    const people = [...byAuthor.values()];
    const vetted = people.filter((m) => m.author_tier && TRUSTED_TIERS.has(m.author_tier));
    const shown = (vetted.length ? vetted : people).slice(0, 3);
    badges.push(
      <span key="x" className="badge badge-x">
        <b>𝕏</b>
        {vetted.length > 1 && <span className="badge-count">{vetted.length} vetted people</span>}
        {shown.map((m, i) => (
          <a
            key={m.author ?? i}
            href={m.discuss_url ?? `https://x.com/${m.author}`}
            target="_blank"
            rel="noopener noreferrer"
            title={m.text ?? undefined}
          >
            @{m.author}
            {m.author_tier && <span className="tier"> · {TIER_LABEL[m.author_tier] ?? m.author_tier}</span>}
          </a>
        ))}
        {people.length > shown.length && <span className="muted">+{people.length - shown.length}</span>}
      </span>
    );
  }

  for (const m of mentions.filter((m) => m.source === "hf").slice(0, 1)) {
    badges.push(
      <a key="hf" className="badge badge-hf" href={m.discuss_url ?? url} target="_blank" rel="noopener noreferrer">
        <b>HF Papers</b> ▲ {compact(eng(m).upvotes)}
      </a>
    );
  }
  for (const m of mentions.filter((m) => m.source === "github").slice(0, 1)) {
    badges.push(
      <a key="gh" className="badge badge-gh" href={m.discuss_url ?? url} target="_blank" rel="noopener noreferrer">
        <b>GitHub</b> ★ {compact(eng(m).stars)}
      </a>
    );
  }
  for (const m of mentions.filter((m) => m.source === "arxiv").slice(0, 1)) {
    badges.push(
      <a key="arxiv" className="badge badge-arxiv" href={m.discuss_url ?? url} target="_blank" rel="noopener noreferrer">
        <b>arXiv</b>
      </a>
    );
  }
  const rss = mentions.filter((m) => m.source === "rss");
  if (rss.length) {
    const names = [...new Set(rss.map((m) => m.author).filter(Boolean))];
    badges.push(
      <span key="rss" className="badge badge-rss">
        <b>Blog</b> {names.join(", ")}
      </span>
    );
  }

  return <div className="badges">{badges}</div>;
}

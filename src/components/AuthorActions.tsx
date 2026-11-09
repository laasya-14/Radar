"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthorActions({ authorKey, override }: { authorKey: string; override: string | null }) {
  const [cur, setCur] = useState(override);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function set(next: "trust" | "block" | null) {
    const prev = cur;
    setCur(next);
    setBusy(true);
    const res = await fetch("/api/authors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: authorKey, override: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setCur(prev);
    else router.refresh();
  }

  return (
    <div className="person-actions">
      <button className={`btn btn-small${cur === "trust" ? " btn-on" : " btn-ghost"}`} disabled={busy} onClick={() => set("trust")}>
        Trust
      </button>
      <button className={`btn btn-small${cur === "block" ? " btn-on btn-neg" : " btn-ghost"}`} disabled={busy} onClick={() => set("block")}>
        Block
      </button>
      {cur && (
        <button className="btn btn-small btn-ghost" disabled={busy} onClick={() => set(null)}>
          Reset
        </button>
      )}
    </div>
  );
}

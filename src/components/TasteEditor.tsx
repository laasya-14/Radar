"use client";

import { useState } from "react";

export default function TasteEditor({
  field,
  initial,
  rows,
  placeholder,
}: {
  field: "profile" | "learned";
  initial: string;
  rows: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = value !== saved;

  async function save() {
    setStatus("Saving…");
    const res = await fetch("/api/taste", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    }).catch(() => null);
    if (res?.ok) {
      setSaved(value);
      setStatus("Saved");
      setTimeout(() => setStatus(null), 1800);
    } else {
      const body = res ? await res.json().catch(() => ({})) : {};
      setStatus(body.error ?? "Couldn't save");
    }
  }

  return (
    <div className="editor">
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            if (dirty) save();
          }
        }}
      />
      <div className="editor-bar">
        <button className="btn btn-small" disabled={!dirty} onClick={save}>
          Save
        </button>
        {dirty && (
          <button className="btn btn-small btn-ghost" onClick={() => setValue(saved)}>
            Discard
          </button>
        )}
        <span className="muted">{status ?? (dirty ? "Unsaved changes · ⌘S" : "")}</span>
      </div>
    </div>
  );
}

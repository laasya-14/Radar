"use client";

import { useState } from "react";
import { startJob } from "./RunPanel";

/** A button that starts a pipeline job; progress shows in the Run panel. */
export default function JobButton({ kind, label, className = "btn" }: { kind: string; label: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="run">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const err = await startJob(kind);
          setMsg(err ?? "Started. Progress is under Run.");
          if (err) setBusy(false);
        }}
      >
        {label}
      </button>
      {msg && <span className="run-msg run-msg-show">{msg}</span>}
    </span>
  );
}

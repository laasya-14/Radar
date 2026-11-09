"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";

type Run = { id: number; kind: string; started_at: string; finished_at: string | null; error: string | null; stats: string | null };
type Status = { jobs: { kind: string; label: string; desc: string }[]; active: Run | null; log: string[]; recent: Run[] };

const LABEL: Record<string, string> = { pipeline: "Finding new things", digest: "New digest", library: "Library update", learn: "Learning" };

/** Start a job from anywhere in the app; the Run panel picks it up and shows progress. */
export async function startJob(kind: string): Promise<string | null> {
  const res = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) }).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  window.dispatchEvent(new CustomEvent("radar-job", { detail: { open: true } }));
  if (!res?.ok) return body.error ?? "Couldn't start.";
  return null;
}

function describe(r: Run | undefined, short = false): { text: string; tone: string } {
  if (!r) return { text: "Not run yet", tone: "idle" };
  const name = LABEL[r.kind] ?? r.kind;
  if (!r.finished_at) return { text: `${name}…`, tone: "busy" };
  if (r.error) return { text: `${short ? "Last run" : name} failed ${timeAgo(r.finished_at)}`, tone: "error" };
  return { text: short ? `Updated ${timeAgo(r.finished_at)}` : `${name} · ${timeAgo(r.finished_at)}`, tone: "ok" };
}

export default function RunPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasActive = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const s = (await fetch("/api/jobs", { cache: "no-store" }).then((r) => r.json()).catch(() => null)) as Status | null;
    if (!s) return;
    setStatus(s);
    // A job just finished: refresh the page's server data so new items/digest appear.
    if (wasActive.current && !s.active) router.refresh();
    wasActive.current = !!s.active;
  }, [router]);

  // Poll fast while something runs, slowly otherwise.
  useEffect(() => {
    poll();
    const id = setInterval(poll, status?.active ? 2000 : 20000);
    return () => clearInterval(id);
  }, [poll, status?.active]);

  useEffect(() => {
    const onJob = (e: Event) => {
      if ((e as CustomEvent).detail?.open) setOpen(true);
      poll();
    };
    window.addEventListener("radar-job", onJob);
    return () => window.removeEventListener("radar-job", onJob);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = status?.active ?? null;
  const d = describe(active ?? status?.recent[0], true);

  return (
    <div className="nav-status" ref={panelRef}>
      <span className={`dot dot-${d.tone}`} aria-hidden />
      <span className="status-text">{d.text}</span>
      <button className={`btn btn-small ${active ? "btn-busy" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {active ? "Running…" : "Run ▾"}
      </button>

      {open && status && (
        <div className="runpanel" role="dialog" aria-label="Run jobs">
          <div className="runpanel-jobs">
            {status.jobs.map((j) => (
              <button
                key={j.kind}
                className="runpanel-job"
                disabled={!!active}
                onClick={async () => {
                  setError(await startJob(j.kind));
                }}
              >
                <span className="runpanel-job-label">
                  {active?.kind === j.kind ? <span className="dot dot-busy" aria-hidden /> : null}
                  {j.label}
                </span>
                <span className="runpanel-job-desc">{j.desc}</span>
              </button>
            ))}
          </div>
          {error && <p className="runpanel-error">{error}</p>}

          {(active || status.log.length > 0) && (
            <div className="runpanel-log">
              <div className="runpanel-log-head">
                {active ? `${LABEL[active.kind] ?? active.kind} · started ${timeAgo(active.started_at)}` : "Last run log"}
              </div>
              <pre>{status.log.join("\n") || "Starting…"}</pre>
            </div>
          )}

          <ul className="runpanel-recent">
            {status.recent.slice(0, 5).map((r) => {
              const x = describe(r);
              return (
                <li key={r.id}>
                  <span className={`dot dot-${x.tone}`} aria-hidden />
                  {x.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

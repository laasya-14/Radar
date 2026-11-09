"use client";

import { useEffect, useState } from "react";
import { startJob } from "./RunPanel";

type KeyState = { set: boolean; hint?: string };

/** Connect X: paste a twitterapi.io key; it's stored in .env.local on the Radar machine. */
export default function XKeyForm() {
  const [state, setState] = useState<KeyState | null>(null);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setState(s.TWITTERAPI_IO_KEY))
      .catch(() => {});
  }, []);

  const save = async (v: string) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ TWITTERAPI_IO_KEY: v }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(body.error ?? "Couldn't save.");
    setValue("");
    setState(v ? { set: true, hint: `…${v.slice(-4)}` } : { set: false });
    setMsg(v ? "Saved." : "Removed.");
  };

  return (
    <div className="settings">
      {state?.set ? (
        <p>
          <span className="settings-ok">✓ X connected</span> <span className="muted">(key {state.hint})</span>{" "}
          <button className="btn btn-small btn-ghost" onClick={() => save("")}>
            Disconnect
          </button>{" "}
          <button className="btn btn-small" onClick={async () => setMsg((await startJob("pipeline")) ?? "Started. Progress is under Run.")}>
            Check X now
          </button>
        </p>
      ) : (
        <>
          <p className="muted">
            Get a key at <a href="https://twitterapi.io" target="_blank" rel="noreferrer">twitterapi.io</a> (pay per result,
            about $5–15 a month) and paste it here. It stays on this Mac.
          </p>
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) save(value.trim());
            }}
          >
            <input type="password" placeholder="twitterapi.io API key" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
            <button className="btn" type="submit" disabled={!value.trim()}>
              Connect X
            </button>
          </form>
        </>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

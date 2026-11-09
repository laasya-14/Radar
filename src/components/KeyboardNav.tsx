"use client";

import { useEffect, useState } from "react";

const KEYS: Record<string, string> = { o: "open", l: "like", d: "dislike", s: "save", e: "explored" };

/** Page-level keyboard navigation over every [data-card] in document order. */
export default function KeyboardNav() {
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let idx = -1;
    const cards = () => Array.from(document.querySelectorAll<HTMLElement>("[data-card]"));
    const focus = (i: number) => {
      const list = cards();
      if (list.length === 0) return;
      idx = Math.max(0, Math.min(list.length - 1, i));
      list.forEach((c) => c.classList.remove("is-focused"));
      const el = list[idx];
      el.classList.add("is-focused");
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const current = () => {
      const list = cards();
      const active = document.activeElement?.closest?.("[data-card]") as HTMLElement | null;
      if (active) idx = list.indexOf(active);
      return idx >= 0 ? list[idx] : null;
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        setHelp((h) => !h);
        return;
      }
      if (e.key === "Escape") {
        setHelp(false);
        return;
      }
      if (e.key === "j") {
        current();
        focus(idx + 1);
        e.preventDefault();
      } else if (e.key === "k") {
        current();
        focus(idx - 1);
        e.preventDefault();
      } else if (KEYS[e.key]) {
        const el = current();
        if (!el) return;
        el.dispatchEvent(new CustomEvent("radar-cmd", { detail: KEYS[e.key] }));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button className="kbd-hint" onClick={() => setHelp((h) => !h)} aria-label="Keyboard shortcuts">
        ?
      </button>
      {help && (
        <div className="help" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setHelp(false)}>
          <div className="help-box" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard</h2>
            <dl>
              <dt>j / k</dt>
              <dd>Next / previous item</dd>
              <dt>o</dt>
              <dd>Open link</dd>
              <dt>l</dt>
              <dd>More like this</dd>
              <dt>d</dt>
              <dd>Not for me</dd>
              <dt>s</dt>
              <dd>Save</dd>
              <dt>e</dt>
              <dd>Mark as done</dd>
              <dt>?</dt>
              <dd>Show or hide this help</dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

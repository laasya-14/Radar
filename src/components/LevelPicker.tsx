"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

type Opt = { id: string; label: string; hint: string };

/** One row per topic: how well you know it. Changes re-rank the feed immediately. */
export default function LevelPicker({ topics, levels, options }: { topics: { id: string; name: string }[]; levels: Record<string, string>; options: Opt[] }) {
  const router = useRouter();
  const [state, setState] = useState(levels);
  const [saved, setSaved] = useState<string | null>(null);

  const change = async (topic: string, level: string) => {
    setState((s) => ({ ...s, [topic]: level }));
    const res = await fetch("/api/levels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, level }) });
    setSaved(res.ok ? topic : null);
    router.refresh();
  };

  return (
    <div className="levels">
      {topics.map((t) => (
        <label key={t.id} className="level-row">
          <span className="level-name">
            <Icon name={t.id} /> {t.name}
          </span>
          <select value={state[t.id]} onChange={(e) => change(t.id, e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {saved === t.id && <span className="settings-ok">Saved</span>}
        </label>
      ))}
      <p className="muted level-help">
        Radar shows things at your level or a little above. In fields you&apos;re new to, it picks explainers before papers.
      </p>
    </div>
  );
}

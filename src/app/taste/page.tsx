import fs from "node:fs";
import path from "node:path";
import { TOPICS } from "@config/topics";
import { dislikeReasonCounts, feedbackStatsByTopic, feedbackTotals, learnedPrefs } from "@/lib/queries";
import { DISLIKE_REASONS, timeAgo } from "@/lib/format";
import TasteEditor from "@/components/TasteEditor";
import JobButton from "@/components/JobButton";
import Icon from "@/components/Icon";
import LevelPicker from "@/components/LevelPicker";
import { LEVELS, topicLevels } from "@/lib/levels";

export const dynamic = "force-dynamic";

export default function TastePage() {
  const profile = fs.readFileSync(path.join(process.cwd(), "config", "profile.md"), "utf8");
  const learned = learnedPrefs();
  const byTopic = feedbackStatsByTopic();
  const reasons = dislikeReasonCounts();
  const totals = feedbackTotals();
  const reasonLabel = Object.fromEntries(DISLIKE_REASONS.map((r) => [r.id, r.label]));
  const maxTopic = Math.max(1, ...byTopic.map((t) => (t.likes ?? 0) + (t.dislikes ?? 0)));

  return (
    <div className="page page-wide">
      <header className="page-head">
        <h1>Taste</h1>
        <p className="page-sub">
          What Radar knows about what you like. You write the left side. Radar writes the right side from your
          ratings. It uses both to choose what to show you.
        </p>
      </header>

      <section className="panel panel-levels">
        <h2>How deep to go</h2>
        <LevelPicker
          topics={TOPICS.map((t) => ({ id: t.id, name: t.name }))}
          levels={{ ...topicLevels() }}
          options={LEVELS.map((l) => ({ ...l }))}
        />
      </section>

      <div className="taste-grid">
        <section className="panel">
          <h2>In your words</h2>
          <TasteEditor field="profile" initial={profile} rows={26} />
        </section>

        <section className="panel">
          <h2>What Radar has learned</h2>
          <p className="panel-note">
            {learned.updated_at ? `Updated ${timeAgo(learned.updated_at)}` : "Nothing yet"} · you can edit this
          </p>
          <TasteEditor
            field="learned"
            initial={learned.value}
            rows={12}
            placeholder="Nothing yet. Rate a few things, then press the button below."
          />
          <div className="panel-actions">
            <JobButton kind="learn" label="Learn from my ratings" className="btn btn-small" />
          </div>

          <h2 className="mt">Your ratings</h2>
          <p className="stats-line">
            <b>{totals.likes}</b> liked · <b>{totals.dislikes}</b> not for me · <b>{totals.saved}</b> saved ·{" "}
            <span className="muted">{totals.events} events</span>
          </p>
          {byTopic.length > 0 ? (
            <table className="stat-table">
              <tbody>
                {TOPICS.map((t) => {
                  const row = byTopic.find((r) => r.topic === t.id);
                  const l = row?.likes ?? 0;
                  const d = row?.dislikes ?? 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <Icon name={t.id} /> {t.name}
                      </td>
                      <td className="bar-cell">
                        <span className="bar bar-pos" style={{ width: `${(l / maxTopic) * 100}%` }} />
                        <span className="bar bar-neg" style={{ width: `${(d / maxTopic) * 100}%` }} />
                      </td>
                      <td className="num">
                        <span className="pos">{l}</span> / <span className="neg">{d}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">No ratings yet.</p>
          )}

          {reasons.length > 0 && (
            <>
              <h3>Why you said no</h3>
              <ul className="reason-list">
                {reasons.map((r) => (
                  <li key={r.reason}>
                    <span>{reasonLabel[r.reason] ?? r.reason}</span>
                    <span className="num">{r.n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

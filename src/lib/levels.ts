import { TOPICS, type Level } from "@config/topics";
import { kvGet, kvSet } from "./db";

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "new", label: "New to it", hint: "Explainers and fundamentals first. Papers only if readable or landmark." },
  { id: "basics", label: "Know the basics", hint: "Clear deep dives. No dense specialist work." },
  { id: "working", label: "Working knowledge", hint: "Technical posts and readable papers." },
  { id: "deep", label: "Deep", hint: "Advanced material is welcome." },
];

/** Your level per topic: what you set on the Taste page, else the default in config/topics.ts. */
export function topicLevels(): Record<string, Level> {
  let saved: Record<string, Level> = {};
  try {
    saved = JSON.parse(kvGet("levels") ?? "{}");
  } catch {}
  return Object.fromEntries(TOPICS.map((t) => [t.id, saved[t.id] ?? t.level]));
}

export function setTopicLevel(topic: string, level: Level) {
  let saved: Record<string, Level> = {};
  try {
    saved = JSON.parse(kvGet("levels") ?? "{}");
  } catch {}
  saved[topic] = level;
  kvSet("levels", JSON.stringify(saved));
}

/** What the judge is told about your depth in a topic. */
export function levelGuidance(topicId: string): string {
  const t = TOPICS.find((x) => x.id === topicId);
  const lvl = topicLevels()[topicId];
  if (!t || !lvl) return "";
  // The hand-written note only matches the default level; if you changed it, use the generic hint.
  const note = lvl === t.level ? t.levelNote : LEVELS.find((l) => l.id === lvl)?.hint ?? "";
  return `Reader's level here: ${lvl.toUpperCase()}. ${note}`;
}

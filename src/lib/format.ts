// Small display helpers safe for both server and client components.

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d ago`;
  const mo = d / 30;
  if (mo < 12) return `${Math.round(mo)}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function compact(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Tiers that count as "vetted" people whose posts we trust. */
export const TRUSTED_TIERS = new Set(["professor", "researcher", "builder", "oss", "lab"]);

export const DISLIKE_REASONS: { id: string; label: string }[] = [
  { id: "wrapper", label: "Wrapper" },
  { id: "shallow", label: "Shallow" },
  { id: "hype", label: "Hype / commentary" },
  { id: "promo", label: "Promotional / selling" },
  { id: "off-topic", label: "Off-topic" },
  { id: "already-knew", label: "Already knew" },
  { id: "too-advanced", label: "Too advanced" },
  { id: "too-basic", label: "Too basic" },
];

export const TOPIC_HUES: Record<string, number> = {
  agents: 265,
  "eng-ai": 30,
  networking: 195,
  go: 185,
  security: 0,
  langs: 45,
  astro: 230,
  robotics: 145,
  quantum: 300,
};

/** Plain names for the people categories Radar assigns. */
export const TIER_LABEL: Record<string, string> = {
  professor: "professor",
  researcher: "researcher",
  builder: "builder",
  oss: "open source",
  lab: "research lab",
  org: "organisation",
  commentator: "commentator",
  hype: "hype / selling",
  unknown: "unknown",
};

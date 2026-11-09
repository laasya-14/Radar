import { TOPICS } from "@config/topics";
import { fetchJson, log, sleep } from "@/lib/util";
import type { Candidate } from "./types";

type Repo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
  language: string | null;
  topics?: string[];
  owner: { login: string };
};

/** New repositories gaining stars fast — overall and per topic. */
export async function collectGitHub(days = 10): Promise<Candidate[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const queries = [
    `created:>${since} stars:>150`,
    ...TOPICS.flatMap((t) => (t.github ?? []).map((g) => `${g} created:>${since} stars:>25`)),
  ];
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const out: Candidate[] = [];
  for (const q of queries) {
    try {
      const res = await fetchJson<{ items: Repo[] }>(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=40`,
        { headers }
      );
      for (const r of res.items) {
        out.push({
          url: r.html_url,
          title: `${r.full_name}${r.description ? ` — ${r.description}` : ""}`.slice(0, 300),
          excerpt: [r.description, r.language && `Language: ${r.language}`, r.topics?.length && `Topics: ${r.topics.join(", ")}`]
            .filter(Boolean)
            .join(". "),
          published_at: r.created_at,
          mention: {
            source: "github",
            source_id: r.full_name.toLowerCase(),
            discuss_url: r.html_url,
            author: r.owner.login,
            text: r.description ?? "",
            engagement: { stars: r.stargazers_count },
            created_at: r.created_at,
          },
        });
      }
    } catch (e) {
      log("github", `"${q}": ${(e as Error).message}`);
    }
    await sleep(process.env.GITHUB_TOKEN ? 500 : 6500); // unauthenticated search: 10 req/min
  }
  return out;
}

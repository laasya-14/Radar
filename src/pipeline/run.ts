import { kvGet } from "@/lib/db";
import { llmCost, llmCostByLabel } from "@/lib/llm";
import { log } from "@/lib/util";
import { collectHN } from "@/collectors/hn";
import { collectHF, collectArxiv } from "@/collectors/papers";
import { collectGitHub } from "@/collectors/github";
import { collectRSS } from "@/collectors/rss";
import { collectX } from "@/collectors/x";
import type { Candidate } from "@/collectors/types";
import { loadEnv } from "./env";
import { storeCandidates } from "./store";
import { vetAuthors, triage, enrich, judge, endorse } from "./judge";
import { rank, buildDigest, digestDue } from "./rank";
import { learn } from "./learn";
import { runLibrary } from "./library";
import { tracked } from "./track";

async function main() {
  loadEnv();
  const args = new Set(process.argv.slice(2));
  await tracked(args.has("--digest-only") ? "digest" : "pipeline", async (stats) => {
    if (!args.has("--digest-only")) {
      // 1. Collect from every source; one failing source never sinks the run.
      const collectors: [string, () => Promise<Candidate[]>][] = [
        ["hn", () => collectHN()],
        ["hf", () => collectHF()],
        ["arxiv", () => collectArxiv()],
        ["github", () => collectGitHub()],
        ["rss", () => collectRSS()],
        ["x", () => collectX()],
      ];
      const results = await Promise.all(
        collectors.map(async ([name, fn]) => {
          try {
            const c = await fn();
            log("collect", `${name}: ${c.length} candidates`);
            return [name, c] as const;
          } catch (e) {
            log("collect", `${name} FAILED: ${(e as Error).message}`);
            return [name, [] as Candidate[]] as const;
          }
        })
      );
      const collected: Record<string, number> = {};
      for (const [name, c] of results) {
        collected[name] = c.length;
        const r = storeCandidates(c);
        log("store", `${name}: +${r.newItems} items, +${r.newMentions} mentions`);
      }
      stats.collected = collected;

      // 2. Library lane: build once, then refresh monthly.
      const libAt = kvGet("library_at");
      if (!libAt || Date.now() - new Date(libAt).getTime() > 30 * 86400_000) stats.library = await runLibrary({ standalone: false });

      // 3. Judge.
      stats.vetted = await vetAuthors();
      log("vet", `${stats.vetted} X authors vetted`);
      stats.triage = await triage();
      log("triage", stats.triage);
      stats.enriched = await enrich();
      log("enrich", `${stats.enriched} pages fetched`);
      stats.judged = await judge();
      log("judge", `${stats.judged} items scored`);
      stats.endorsed = await endorse();
      log("endorse", `${stats.endorsed} HN threads read for endorsements`);

      // 4. Learn from feedback weekly.
      const learnedAt = kvGet("learned_at");
      if (!learnedAt || Date.now() - new Date(learnedAt).getTime() > 7 * 86400_000) {
        try {
          stats.learned = await learn();
        } catch (e) {
          log("learn", (e as Error).message);
        }
      }
    }

    stats.ranked = rank();
    if (args.has("--digest") || args.has("--digest-only") || digestDue()) stats.digest = await buildDigest();
    stats.llm_cost_usd = Math.round(llmCost() * 1000) / 1000;
    stats.llm_by_stage = llmCostByLabel();
    log("done", stats);
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

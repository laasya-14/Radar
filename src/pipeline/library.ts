import { kvSet, now } from "@/lib/db";
import { log } from "@/lib/util";
import { collectHNLibrary } from "@/collectors/hn";
import { loadEnv } from "./env";
import { storeCandidates } from "./store";
import { triage, enrich, judge, endorse } from "./judge";
import { rank } from "./rank";
import { tracked } from "./track";

/**
 * Library lane: the all-time most-loved Hacker News stories in your topics, judged for lasting
 * value — fundamentals, classic explainers, "how X really works". Mixed into each digest.
 */
export async function runLibrary({ standalone }: { standalone: boolean }) {
  const cands = await collectHNLibrary();
  const stored = storeCandidates(cands);
  log("library", `${cands.length} classics found, ${stored.newItems} new`);
  kvSet("library_at", now());
  if (standalone) {
    log("library", await triage());
    await enrich();
    log("library", `${await judge()} judged`);
    await endorse(60);
    rank();
  }
  return stored;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  tracked("library", async (stats) => {
    stats.library = await runLibrary({ standalone: true });
  })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

import { spawn } from "node:child_process";
import os from "node:os";
import { log } from "./util";

// LLM calls go through the local Claude Code CLI in headless mode, so Radar runs on your
// existing Claude login — no API key to manage. Models are configurable via env.
export const MODELS = {
  triage: process.env.RADAR_TRIAGE_MODEL ?? "haiku",
  judge: process.env.RADAR_JUDGE_MODEL ?? "sonnet",
};

let totalCost = 0;
const costByLabel: Record<string, { calls: number; usd: number; outTokens: number; thinking: number }> = {};
export const llmCost = () => totalCost;
export const llmCostByLabel = () => costByLabel;

const MAX_PARALLEL = Number(process.env.RADAR_LLM_PARALLEL ?? 4);
let active = 0;
const queue: (() => void)[] = [];
async function acquire() {
  if (active < MAX_PARALLEL) {
    active++;
    return;
  }
  await new Promise<void>((r) => queue.push(r));
  active++;
}
function release() {
  active--;
  queue.shift()?.();
}

export async function llmJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: object;
  label?: string;
  timeoutMs?: number;
}): Promise<T> {
  await acquire();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await runOnce<T>(opts, opts.label ?? "call");
      } catch (e) {
        log("llm", `${opts.label ?? "call"} attempt ${attempt + 1} failed: ${(e as Error).message.slice(0, 200)}`);
        if (attempt === 2) throw e;
      }
    }
    throw new Error("unreachable");
  } finally {
    release();
  }
}

function runOnce<T>(opts: { model: string; system: string; prompt: string; schema: object; timeoutMs?: number }, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model", opts.model,
      "--tools", "",
      "--no-session-persistence",
      "--setting-sources", "",
      // Without these, any MCP servers or connectors on the account get loaded as tools
      // and inflate every call by ~500k tokens.
      "--strict-mcp-config",
      "--mcp-config", JSON.stringify({ mcpServers: {} }),
      "--system-prompt", opts.system,
      "--json-schema", JSON.stringify(opts.schema),
      "--output-format", "json",
    ];
    const child = spawn(process.env.RADAR_CLAUDE_BIN ?? "claude", args, {
      cwd: os.tmpdir(), // keep project files/CLAUDE.md out of the judge's context
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout"));
    }, opts.timeoutMs ?? 240_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        const cost = Number(parsed.total_cost_usd ?? 0);
        totalCost += cost;
        const c = (costByLabel[label] ??= { calls: 0, usd: 0, outTokens: 0, thinking: 0 });
        c.calls++;
        c.usd += cost;
        for (const u of Object.values((parsed.modelUsage ?? {}) as Record<string, { outputTokens?: number; thinkingTokens?: number }>)) {
          c.outTokens += u.outputTokens ?? 0;
          c.thinking += u.thinkingTokens ?? 0;
        }
        if (process.env.RADAR_LLM_DEBUG) log("llm-usage", label, cost.toFixed(4), JSON.stringify(parsed.modelUsage));
        if (parsed.is_error) return reject(new Error(String(parsed.result ?? "llm error")));
        const data = parsed.structured_output ?? JSON.parse(parsed.result);
        resolve(data as T);
      } catch {
        reject(new Error(`exit ${code}: ${(err || out).slice(0, 300)}`));
      }
    });
    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}

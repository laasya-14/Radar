import fs from "node:fs";
import path from "node:path";

/** Load .env.local / .env for CLI runs (Next.js loads these itself for the UI). */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (fs.existsSync(p)) process.loadEnvFile(p);
  }
}

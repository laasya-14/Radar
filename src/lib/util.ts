import crypto from "node:crypto";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) RadarPersonalReader/0.1";

export async function fetchText(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<string> {
  const { timeoutMs = 20000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { "User-Agent": UA, ...(rest.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      return await res.text();
    } catch (e) {
      lastErr = e;
      if ((e as { fatal?: boolean }).fatal) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export async function fetchJson<T = unknown>(url: string, init: Parameters<typeof fetchText>[1] = {}): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}

const TRACKING = /^(utm_|ref$|ref_src$|source$|s$|t$|fbclid$|gclid$|mc_|igshid$|si$)/;

/** Normalize a URL so the same thing seen on HN, X and a blog maps to one item. */
export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  // arXiv: abs/pdf/html with or without version -> abs/<id>
  const ax = u.hostname.endsWith("arxiv.org") && u.pathname.match(/^\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(v\d+)?/);
  if (ax) return `https://arxiv.org/abs/${ax[1]}`;
  // HF papers page == arXiv paper
  const hf = u.hostname === "huggingface.co" && u.pathname.match(/^\/papers\/(\d{4}\.\d{4,5})/);
  if (hf) return `https://arxiv.org/abs/${hf[1]}`;
  if (u.hostname === "twitter.com") u.hostname = "x.com";
  if (u.hostname === "github.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && !["blob", "tree"].includes(parts[2] ?? "")) {
      u.pathname = `/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
      u.search = "";
    }
  }
  u.protocol = "https:";
  let s = u.toString();
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
  return s;
}

export const itemIdFor = (canonical: string) => crypto.createHash("sha1").update(canonical).digest("hex").slice(0, 16);

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function stripHtml(html: string | null | undefined, max = 1200): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** Run async fns over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);

export function log(scope: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${scope}:`, ...args);
}

/** Turn inline LaTeX in paper titles into plain text: "$\mathsf{StoqMA}$" -> "StoqMA". */
export function cleanTitle(t: string): string {
  return t
    // Only $...$ spans that look like math (contain \ ^ _ { } or are a single symbol), so money like "$11B" survives.
    .replace(/\$([^$\d][^$]*?)\$/g, (whole: string, inner: string) => !/[\\^_{}]/.test(inner) && inner.trim().length > 2 ? whole :
      inner
        .replace(/\\(?:mathsf|mathrm|mathbf|mathit|mathcal|text|textbf|textit|operatorname)\{([^}]*)\}/g, "$1")
        .replace(/\\(alpha|beta|gamma|delta|epsilon|lambda|mu|pi|sigma|tau|phi|omega|Omega|Lambda)/g, (m: string) => GREEK[m] ?? m)
        .replace(/\\(?:,|;|!| )/g, " ")
        .replace(/[{}]/g, "")
        .replace(/\\/g, "")
    )
    .replace(/\s+/g, " ")
    .trim();
}
const GREEK: Record<string, string> = {
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\epsilon": "ε", "\\lambda": "λ", "\\mu": "μ",
  "\\pi": "π", "\\sigma": "σ", "\\tau": "τ", "\\phi": "φ", "\\omega": "ω", "\\Omega": "Ω", "\\Lambda": "Λ",
};

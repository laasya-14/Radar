# Radar

A personal reader that collects from X, Hacker News, Hugging Face Daily Papers, arXiv, GitHub
and a set of strong engineering/research blogs, then judges each item against **your** taste. It
builds a digest every two days and learns from what you mark.

```
collect ─► store/merge ─► vet X authors ─► triage (Haiku) ─► fetch page text ─► judge (Sonnet)
   │          one item per URL;      by background,      drops noise,              novelty · depth ·
   │          HN + X + blog          not follower count  wrappers, off-topic       learning · fit · why
   │          mentions merge
   └─► endorsements: reads HN comments, counts distinct people who genuinely recommend it
       (the HackerTube idea) ─► rank (+ your 👍👎 affinities) ─► digest every ~2 days
```

## Open it

- On this machine: http://localhost:4747
- From any device on your tailnet (after `scripts/schedule.sh install`): `https://<machine-name>.<your-tailnet>.ts.net:4747`. The install script prints the exact URL.

Everything runs from the UI. The **Run** menu (top right) has *Find new things*, *Make a new digest*,
*Update the library* and *Learn from my ratings*, with live progress and the log. Connect X from the
**People** page.

## Always on

```bash
scripts/schedule.sh install     # web server always up + pipeline at 07:00 and 19:00 + Tailscale URL
scripts/schedule.sh status
scripts/schedule.sh uninstall   # stop everything and remove the Tailscale route
```
A digest is built automatically once roughly two days have passed since the last one. Logs are in `data/logs/`.
After changing UI code, re-run `scripts/schedule.sh install` to rebuild and restart the server.

## CLI (optional)

```bash
npm run pipeline   # collect + score
npm run digest     # new digest now
npm run library    # rebuild the all-time library
npm run learn      # re-learn preferences from feedback
npm run dev        # dev server (stop the always-on one first: scripts/schedule.sh uninstall)
```

LLM calls go through your local `claude` CLI (headless), so it uses whatever account that CLI is logged in to. No API
key is needed (set `ANTHROPIC_API_KEY` if you would rather bill an API key). Change models with `RADAR_TRIAGE_MODEL` / `RADAR_JUDGE_MODEL` (defaults:
`haiku` / `sonnet`).

### X
Paste a key on the **People** page, or add it to `.env.local`:
```
TWITTERAPI_IO_KEY=...      # https://twitterapi.io — pay per result, roughly $5-15/month at this volume
```
There is no hand-picked list of people. Radar searches each topic, vets every author from
their bio (professor / researcher / fundamental builder / OSS hacker versus commentator /
hype), and only considers posts from people who pass. People who pass are swept directly on
later runs, so the list grows by itself. You can override any person on the **People** page.

Optional: `GITHUB_TOKEN` for faster GitHub searches.

## Tuning it
- `config/profile.md`: your taste in plain words. This matters most. It's also editable on the **Taste** page.
- `config/topics.ts`: topics, what "good" means in each, the search terms per source, and the digest quota per topic.
- `config/feeds.ts`: starter blogs.
- **Learned preferences** (Taste page): the system rewrites these weekly from your 👍/👎/save/explored marks and dislike reasons. You can edit them, or press "Re-learn".
- Ranking weights live in `src/pipeline/rank.ts`.

## Two lanes
- **Fresh**: the last few days, with per-topic quotas so niche topics (robotics, astro) aren't drowned out. Each digest also has a couple of "outside your bubble" picks chosen for high novelty.
- **Library**: the all-time most-loved Hacker News stories in your topics, judged for lasting value. Built on the first run and refreshed monthly. 2–3 go into each digest.

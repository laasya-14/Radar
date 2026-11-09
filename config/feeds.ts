// Starter blogs (primary sources written by people doing the work). Everything still goes
// through the same judge, so a feed here is a candidate source, not a guarantee.
// Add/remove freely. `topics` is a hint for the judge, not a filter.

export type Feed = { url: string; name: string; topics: string[] };

export const FEEDS: Feed[] = [
  // Agents & LLMs
  { url: "https://simonwillison.net/atom/everything/", name: "Simon Willison", topics: ["agents", "eng-ai"] },
  { url: "https://lilianweng.github.io/index.xml", name: "Lilian Weng", topics: ["agents"] },
  { url: "https://magazine.sebastianraschka.com/feed", name: "Sebastian Raschka", topics: ["agents"] },
  { url: "https://www.interconnects.ai/feed", name: "Interconnects (Nathan Lambert)", topics: ["agents"] },
  { url: "https://karpathy.bearblog.dev/feed/", name: "Andrej Karpathy", topics: ["agents", "eng-ai"] },
  { url: "https://hamel.dev/index.xml", name: "Hamel Husain", topics: ["agents"] },
  { url: "https://eugeneyan.com/rss/", name: "Eugene Yan", topics: ["agents"] },
  { url: "https://huyenchip.com/feed.xml", name: "Chip Huyen", topics: ["agents"] },
  { url: "https://bair.berkeley.edu/blog/feed.xml", name: "Berkeley AI Research", topics: ["agents", "robotics"] },
  { url: "https://deepmind.google/blog/rss.xml", name: "Google DeepMind", topics: ["agents", "robotics", "astro"] },
  { url: "https://thegradient.pub/rss/", name: "The Gradient", topics: ["agents"] },
  { url: "https://jack-clark.net/feed/", name: "Import AI (Jack Clark)", topics: ["agents"] },
  // Engineering in the age of AI
  { url: "https://mitchellh.com/feed.xml", name: "Mitchell Hashimoto", topics: ["eng-ai", "go"] },
  { url: "https://lucumr.pocoo.org/feed.atom", name: "Armin Ronacher", topics: ["eng-ai", "agents"] },
  { url: "https://jvns.ca/atom.xml", name: "Julia Evans", topics: ["eng-ai", "networking"] },
  { url: "https://danluu.com/atom.xml", name: "Dan Luu", topics: ["eng-ai"] },
  { url: "https://matklad.github.io/feed.xml", name: "matklad", topics: ["langs", "eng-ai"] },
  { url: "https://www.seangoedecke.com/rss.xml", name: "Sean Goedecke", topics: ["eng-ai"] },
  { url: "https://xeiaso.net/blog.rss", name: "Xe Iaso", topics: ["eng-ai", "networking"] },
  { url: "https://thume.ca/atom.xml", name: "Tristan Hume", topics: ["eng-ai", "langs"] },
  // Networking
  { url: "https://tailscale.com/blog/index.xml", name: "Tailscale", topics: ["networking"] },
  { url: "https://apenwarr.ca/log/rss.php", name: "apenwarr (Avery Pennarun)", topics: ["networking", "eng-ai"] },
  { url: "https://blog.cloudflare.com/rss/", name: "Cloudflare", topics: ["networking", "security"] },
  { url: "https://fly.io/blog/feed.xml", name: "Fly.io", topics: ["networking", "eng-ai"] },
  // Go
  { url: "https://go.dev/blog/feed.atom", name: "The Go Blog", topics: ["go"] },
  { url: "https://research.swtch.com/feed.atom", name: "Russ Cox", topics: ["go", "langs"] },
  { url: "https://eli.thegreenplace.net/feeds/all.atom.xml", name: "Eli Bendersky", topics: ["go", "langs"] },
  // Security
  { url: "https://googleprojectzero.blogspot.com/feeds/posts/default", name: "Project Zero", topics: ["security"] },
  { url: "https://blog.trailofbits.com/feed/", name: "Trail of Bits", topics: ["security"] },
  { url: "https://words.filippo.io/rss/", name: "Filippo Valsorda", topics: ["security", "go"] },
  { url: "https://lcamtuf.substack.com/feed", name: "lcamtuf", topics: ["security", "eng-ai"] },
  // C++ / OCaml / languages
  { url: "https://blog.janestreet.com/feed.xml", name: "Jane Street Tech", topics: ["langs"] },
  { url: "https://herbsutter.com/feed/", name: "Herb Sutter", topics: ["langs"] },
  { url: "https://lemire.me/blog/feed/", name: "Daniel Lemire", topics: ["langs"] },
  // Science / robotics
  { url: "https://www.quantamagazine.org/feed/", name: "Quanta Magazine", topics: ["astro", "agents"] },
  { url: "https://evjang.com/feed.xml", name: "Eric Jang", topics: ["robotics", "agents"] },
  { url: "https://itcanthink.substack.com/feed", name: "It Can Think (Chris Paxton)", topics: ["robotics"] },
  // Quantum computing
  { url: "https://scottaaronson.blog/?feed=rss2", name: "Scott Aaronson (Shtetl-Optimized)", topics: ["quantum"] },
  { url: "https://quantumfrontiers.com/feed/", name: "Quantum Frontiers (Caltech IQIM)", topics: ["quantum"] },
  { url: "https://www.quantamagazine.org/physics/feed/", name: "Quanta Magazine — Physics", topics: ["quantum", "astro"] },
];

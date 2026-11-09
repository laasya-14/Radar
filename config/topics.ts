// Topics Radar looks for. Each one tells collectors what to search for and tells the judge
// what "good" means in that area. Edit freely; ids are stored in the DB, so keep them stable.

export type Topic = {
  id: string;
  name: string;
  emoji: string;
  /** What good content looks like here — given to the judge model. */
  brief: string;
  /** Hacker News search terms (Algolia). */
  hn: string[];
  /** arXiv categories to pull new papers from. */
  arxiv?: string[];
  /** X search queries (operators allowed). Quality operators are appended automatically. */
  x: string[];
  /** GitHub search fragments for new repos. */
  github?: string[];
  /** Max items from this topic in one digest. */
  digestQuota: number;
  /** How well you know this field: new | basics | working | deep. Used by the judge and the ranking. */
  level: Level;
  /** In your words: what depth to show in this field. */
  levelNote: string;
};

export type Level = "new" | "basics" | "working" | "deep";

// What "a little above your level" means: the item levels each of your levels is happy with.
export const OK_ITEM_LEVELS: Record<Level, string[]> = {
  new: ["intro", "intermediate"],
  basics: ["intro", "intermediate"],
  working: ["intermediate", "advanced"],
  deep: ["intermediate", "advanced"],
};

export const TOPICS: Topic[] = [
  {
    id: "agents",
    name: "Agent harnesses & LLMs",
    emoji: "🧠",
    brief:
      "How agents and agent harnesses are really built (tool loops, context management, memory, evals, sandboxes), plus fundamental LLM work: training, inference, interpretability, reasoning, new architectures. Reject thin wrappers and yet-another-framework launches.",
    hn: ["agent harness", "coding agent", "LLM", "context engineering", "Claude Code", "inference", "transformer", "interpretability"],
    // No raw arXiv here on purpose: cs.CL/LG/AI publish hundreds of papers a day. For ML,
    // Hugging Face Daily Papers (community-upvoted) + researchers on X are the filter.
    x: ['("agent harness" OR "coding agent" OR "agent loop" OR "context engineering")', '("new paper" OR "our paper" OR arxiv.org) (LLM OR agents OR reasoning OR interpretability)'],
    github: ["topic:llm", "topic:agents"],
    digestQuota: 5,
    level: "working",
    levelNote:
      "I have working knowledge. Technical posts and readable papers are good. Skip very dense theory unless it changes how agents are built.",
  },
  {
    id: "eng-ai",
    name: "Engineering in the age of AI",
    emoji: "🛠️",
    brief:
      "How strong engineers learn, work and set up their environments now; where software engineering, tooling and careers are heading because of AI. Must contain real insight from experience, not app lists or hot takes.",
    hn: ["my setup", "how I use", "workflow", "future of programming", "software engineering AI", "learning", "Ask HN"],
    x: ['("how I work" OR "my workflow" OR "my setup" OR "how I learn") (engineering OR programming OR coding)', '("future of software" OR "software engineering" OR "programming") (AI OR agents) "I think"'],
    digestQuota: 4,
    level: "working",
    levelNote:
      "I am a working engineer. Practical, experience-based pieces are best.",
  },
  {
    id: "networking",
    name: "Networking (Tailscale, VPNs, protocols)",
    emoji: "🌐",
    brief:
      "Networking fundamentals and novel systems: WireGuard/Tailscale internals, NAT traversal, mesh VPNs, DNS, QUIC/TCP, routing, network security. Deep technical write-ups preferred.",
    hn: ["Tailscale", "WireGuard", "VPN", "NAT traversal", "QUIC", "DNS", "networking"],
    arxiv: ["cs.NI"],
    x: ["(Tailscale OR WireGuard OR \"NAT traversal\" OR QUIC OR \"mesh VPN\")"],
    digestQuota: 3,
    level: "basics",
    levelNote:
      "I know the basics. Show clear deep dives into how things actually work (Tailscale, WireGuard, NAT, DNS), not dense protocol papers.",
  },
  {
    id: "go",
    name: "Go",
    emoji: "🐹",
    brief:
      "Go language and runtime internals, performance, notable Go systems and libraries, proposals and design discussions. Not beginner tutorials.",
    hn: ["golang", "Go language", "Go runtime", "Go generics"],
    x: ["(golang OR \"Go runtime\" OR \"Go 1.2\" OR \"go.dev\")"],
    github: ["language:go"],
    digestQuota: 2,
    level: "new",
    levelNote:
      "I am new to Go. Show approachable intros and explainers about how Go works and why it is designed that way. Deep runtime internals only if explained simply.",
  },
  {
    id: "security",
    name: "Cybersecurity",
    emoji: "🔐",
    brief:
      "Vulnerability research, exploitation write-ups, novel attack/defense techniques, cryptography and crypto engineering (including post-quantum cryptography and its real-world migration), AI x security (agent security, prompt injection with real substance). Not breach news or vendor marketing.",
    hn: ["vulnerability", "exploit", "security", "cryptography", "prompt injection", "CVE", "post-quantum cryptography"],
    arxiv: ["cs.CR"],
    x: ["(exploit OR \"vulnerability research\" OR \"0day\" OR \"prompt injection\" OR cryptography) (writeup OR paper OR blog)"],
    digestQuota: 3,
    level: "basics",
    levelNote:
      "I know the basics. Show readable write-ups of real attacks and clear explanations of how crypto works. Dense crypto papers only if they are landmark and explained.",
  },
  {
    id: "langs",
    name: "C++, OCaml & languages in the age of AI",
    emoji: "⚙️",
    brief:
      "C++, OCaml and programming languages in the age of AI: how LLMs write, translate and verify code in these languages, AI-assisted compilers and tooling, how language design is changing because of AI, and notable current work (memory safety, verification, performance). Deep write-ups and new ideas.",
    hn: ["C++", "OCaml", "compiler", "type system", "programming language", "LLM compiler", "formal verification"],
    arxiv: ["cs.PL"],
    x: [
      "(OCaml OR \"C++\" OR compiler OR \"type system\") (paper OR blog OR \"we built\")",
      "(LLM OR \"AI\" OR agents) (compiler OR \"formal verification\" OR OCaml OR \"C++\" OR \"programming language\")",
    ],
    github: ["language:ocaml"],
    digestQuota: 3,
    level: "deep",
    levelNote:
      "I know C++, OCaml and compilers well. What I want is how these languages and tools relate to AI now (LLMs writing or verifying code, AI compilers, how languages are changing) and what interesting work is happening right now. Advanced material is fine.",
  },
  {
    id: "astro",
    name: "Astronomy, astrophysics & physics × CS",
    emoji: "🔭",
    brief:
      "New results and great explainers in astronomy, astrophysics, cosmology and physics — and especially where they meet computer science: simulations and numerical methods, HPC/GPU codes, telescope data pipelines and software, ML/AI for scientific discovery, physics-informed models. Must be learnable for a strong engineer without a physics PhD; reject pure press-release fluff.",
    hn: ["astronomy", "astrophysics", "telescope", "cosmology", "JWST", "exoplanet", "physics", "computational physics", "physics simulation"],
    arxiv: ["astro-ph.IM", "astro-ph.CO", "astro-ph.GA", "astro-ph.EP", "physics.comp-ph"],
    x: [
      "(astrophysics OR astronomy OR cosmology OR JWST OR exoplanet OR physics) (paper OR \"new result\" OR thread)",
      "(\"computational astrophysics\" OR \"AI for science\" OR \"ML for physics\" OR \"physics simulation\" OR \"scientific computing\") (paper OR code OR arxiv)",
    ],
    digestQuota: 3,
    level: "basics",
    levelNote:
      "I have high-school and a little college physics. Most interested in how astronomy/physics are meeting AI and computing now. Accessible explainers first, but an occasional deep technical piece is welcome if it is genuinely interesting.",
  },
  {
    id: "robotics",
    name: "Robotics",
    emoji: "🤖",
    brief:
      "Get me up to speed in robotics: fundamentals (control, kinematics, SLAM, manipulation, sim-to-real), great explainers and surveys, and genuinely new results (VLA models, embodied AI, hardware). Prefer material that builds understanding over product demos.",
    hn: ["robotics", "robot", "humanoid", "SLAM", "manipulation", "control theory"],
    arxiv: ["cs.RO"],
    x: ["(robotics OR \"robot learning\" OR humanoid OR VLA OR \"embodied AI\") (paper OR results OR \"we built\")"],
    github: ["topic:robotics"],
    digestQuota: 3,
    level: "new",
    levelNote:
      "I am new to robotics. Fundamentals, clear explainers and get-up-to-speed material first. Papers only if readable or landmark.",
  },
  {
    id: "quantum",
    name: "Quantum computing (× crypto & security)",
    emoji: "⚛️",
    brief:
      "Quantum computing fundamentals and real progress: algorithms, error correction, hardware milestones (with the actual numbers), complexity results, clear explainers that build intuition — and its intersection with cryptography and security: Shor/resource estimates for breaking RSA/ECC, post-quantum cryptography (ML-KEM, ML-DSA) and migration, QKD and quantum networking. Reject hype press releases and 'quantum will break everything' fluff.",
    hn: ["quantum computing", "quantum error correction", "qubit", "quantum algorithm", "post-quantum", "Shor's algorithm", "quantum cryptography"],
    arxiv: ["quant-ph"],
    x: [
      '("quantum computing" OR "quantum error correction" OR qubits OR "logical qubit") (paper OR result OR arxiv)',
      '("post-quantum" OR PQC OR "ML-KEM" OR "Shor\'s algorithm" OR "quantum cryptanalysis" OR QKD)',
    ],
    github: ["topic:quantum-computing"],
    digestQuota: 2,
    level: "new",
    levelNote:
      "I am new to quantum computing. Basics and intuition first: qubits, gates, why results matter. Papers only if readable or landmark; prefer explainers of new results.",
  },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

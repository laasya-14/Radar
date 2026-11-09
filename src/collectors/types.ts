import type { Engagement } from "@/lib/db";

export type Candidate = {
  url: string;
  title: string;
  excerpt?: string;
  published_at?: string;
  lane?: "fresh" | "library";
  mention: {
    source: "hn" | "x" | "hf" | "arxiv" | "github" | "rss";
    source_id: string;
    discuss_url?: string;
    author?: string;
    text?: string;
    engagement?: Engagement;
    created_at?: string;
  };
  /** X only: profile info used to vet the person by background. */
  author?: { key: string; name?: string; bio?: string; followers?: number };
};

export type Collector = { name: string; collect: () => Promise<Candidate[]> };

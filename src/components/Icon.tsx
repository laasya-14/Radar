import type { ReactNode } from "react";

// Monochrome line icons drawn with currentColor, in the same 1.6 stroke style as the theme toggle.
const PATHS: Record<string, ReactNode> = {
  // Topics
  agents: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5ZM18.5 16v4M16.5 18h4" />,
  "eng-ai": <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />,
  networking: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ),
  go: <path d="M4.5 6.5 10 12l-5.5 5.5M12.5 18h7" />,
  security: <path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-2.5ZM9.5 12l1.8 1.8 3.4-3.6" />,
  langs: (
    <path d="M8.5 4H8a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h.5M15.5 4h.5a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-.5" />
  ),
  astro: (
    <>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-28 12 12)" />
      <circle cx="19.2" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  robotics: (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
      <path d="M12 8V4.5M9.5 12.5v1.5M14.5 12.5v1.5M2.5 12.5v3M21.5 12.5v3" />
      <circle cx="12" cy="4" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  quantum: (
    <>
      <ellipse cx="12" cy="12" rx="9.5" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  other: <circle cx="12" cy="12" r="3" />,
  library: <path d="M5 19V5.5a2 2 0 0 1 2-2h12V17H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12v-4M9 7.5h6" />,
  // Card actions
  up: <path d="M7.5 10.5v9H4.5v-9h3Zm0 0 3.6-6.2c.9 0 2.4.6 2.4 2.4v2.8h4.6a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.4a1.8 1.8 0 0 1-1.8 1.5H7.5" />,
  down: <path d="M16.5 13.5v-9h3v9h-3Zm0 0-3.6 6.2c-.9 0-2.4-.6-2.4-2.4v-2.8H5.9a1.8 1.8 0 0 1-1.8-2.1l1.2-6.4a1.8 1.8 0 0 1 1.8-1.5h9.4" />,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  note: <path d="M14.5 5.5l4 4M4.5 19.5l1-4.5L15.8 4.7a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9 18.5l-4.5 1Z" />,
};

export default function Icon({ name, filled = false, className = "icon" }: { name: string; filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.other}
    </svg>
  );
}

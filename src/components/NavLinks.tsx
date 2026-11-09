"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Digest" },
  { href: "/feed", label: "Feed" },
  { href: "/library", label: "Library" },
  { href: "/saved", label: "Saved" },
  { href: "/taste", label: "Taste" },
  { href: "/people", label: "People" },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav-links" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

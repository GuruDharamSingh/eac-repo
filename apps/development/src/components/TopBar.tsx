"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Blocks" },
  { href: "/design-systems", label: "Design systems" },
  { href: "/themes", label: "Themes" },
  { href: "/sites", label: "Sites" },
  { href: "/ideas", label: "Ideas" },
  { href: "/workspace", label: "Workspace" },
];

/** The only chrome: a name, three views, who is signed in. Paths are basePath-relative (Next adds /development). */
export function TopBar({ email }: { email: string }) {
  const path = usePathname() || "/";
  const here = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="dev-top" aria-label="Development">
      <span className="dev-brand">Development</span>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="dev-tab" aria-current={here(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
      <span className="dev-who">{email} · network admin · sandbox</span>
    </nav>
  );
}

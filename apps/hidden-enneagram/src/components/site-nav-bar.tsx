"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Menu, X } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  /** Draws a lock — a members-only section this viewer can open. */
  locked?: boolean;
  /** Rendered in full foreground rather than muted (Sign in / Members). */
  strong?: boolean;
}

/**
 * The site bar, and the one thing the published Silex page could never have:
 * a menu that opens.
 *
 * The Silex template ships a decorative hamburger — three spans with no
 * behaviour, because `sanitizeSilexHtml` strips `<script>` from published
 * artifacts, so no static page of ours can carry its own interactivity. That
 * is the whole argument for this inversion: Silex renders the *content* and
 * React keeps the *chrome*, so the parts that need state live where state
 * exists. `omitSections={["eac-enn-nav"]}` drops the template's bar at render
 * time and this one takes its place.
 *
 * Below `md` the links collapse into a drawer; at `md` and up they sit inline
 * either side of the mark, which is the layout the template was imitating.
 */
export function SiteNavBar({
  primary,
  secondary,
}: {
  primary: NavLink[];
  secondary: NavLink[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating with the drawer open would otherwise leave it covering the
  // page it just moved to.
  useEffect(() => setOpen(false), [pathname]);

  // A drawer that scrolls the page behind it reads as broken on a phone.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur md:px-7">
      <div className="flex items-center gap-5 justify-self-start">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-nav-drawer"
          className="inline-flex items-center justify-center rounded-sm p-1 text-foreground transition-colors hover:text-primary md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <nav className="hidden items-center gap-5 md:flex">
          {primary.map((link) => (
            <NavAnchor key={link.href} link={link} />
          ))}
        </nav>
      </div>

      <Link href="/" aria-label="Home" className="justify-self-center text-foreground">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          aria-hidden
          className="block size-[30px] opacity-90"
        >
          <circle cx="50" cy="50" r="42" />
          <path d="M84.6 70 L15.4 70 L50 8 Z" />
          <path d="M75.7 19.4 L63.7 87.6 L89.4 43.1 L24.3 19.4 L36.3 87.6 L10.6 43.1 Z" />
        </svg>
      </Link>

      <nav className="flex items-center gap-5 justify-self-end">
        {secondary.map((link) => (
          <NavAnchor
            key={link.href}
            link={link}
            // On a phone only the last item (Sign in / Members) stays in the
            // bar; the rest are in the drawer with everything else.
            className={link === secondary[secondary.length - 1] ? undefined : "hidden md:inline-flex"}
          />
        ))}
      </nav>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full z-40 h-screen cursor-default bg-black/60 md:hidden"
          />
          <div
            id="site-nav-drawer"
            className="absolute inset-x-0 top-full z-50 max-h-[80vh] overflow-y-auto border-b border-border/70 bg-background px-5 pb-4 md:hidden"
          >
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {[...primary, ...secondary].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-2 border-b border-border/40 py-3 text-[13px] uppercase tracking-[0.12em] text-foreground no-underline transition-colors hover:text-primary"
                  >
                    {link.label}
                    {link.locked && <Lock className="size-3" aria-label="Members only" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </header>
  );
}

function NavAnchor({ link, className }: { link: NavLink; className?: string }) {
  return (
    <Link
      href={link.href}
      className={[
        "inline-flex items-center gap-1 text-[13px] uppercase tracking-[0.12em] no-underline transition-colors hover:text-primary",
        link.strong ? "text-foreground" : "text-muted-foreground",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      {link.label}
      {link.locked && <Lock className="size-3" aria-label="Members only" />}
    </Link>
  );
}

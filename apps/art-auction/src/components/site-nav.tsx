"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
  /** Only in the narrow-screen menu — the header shows it another way above. */
  narrowOnly?: boolean;
}

/**
 * The marketplace's navigation, on every screen size.
 *
 * It used to be a single `hidden md:flex` row with nothing behind it: on a
 * phone — where most people meet a marketplace — Artworks, Auctions, Artists
 * and Sell were simply unreachable, leaving the cart and sign-in as the whole
 * of the site. This keeps the same row on wide screens and puts it behind a
 * disclosure below them.
 *
 * A `<details>` rather than state plus a click-outside handler: it closes on
 * Escape, is operable from the keyboard, and works before hydration.
 */
export function SiteNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const ref = React.useRef<HTMLDetailsElement>(null);

  // Close the panel after a navigation — a menu still hanging open over the
  // page you asked for reads as a failed tap.
  React.useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <nav aria-label="Main" className="hidden gap-6 text-sm md:flex">
        {links.filter((l) => !l.narrowOnly).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isCurrent(l.href) ? "page" : undefined}
            className={
              "underline-offset-4 hover:underline aria-[current=page]:font-medium " +
              "aria-[current=page]:underline"
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <details ref={ref} className="relative md:hidden">
        <summary
          className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-border [&::-webkit-details-marker]:hidden"
          aria-label="Menu"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ☰
          </span>
        </summary>
        <nav
          aria-label="Main"
          className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isCurrent(l.href) ? "page" : undefined}
              className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted aria-[current=page]:font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </details>
    </>
  );
}

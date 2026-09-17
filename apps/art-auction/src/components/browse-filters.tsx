"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * The browse controls: what kind of work, in what order, and whether to hide
 * pieces that carry no price.
 *
 * Every control writes to the URL rather than to component state, so a
 * filtered view can be linked, shared and gone back to — which is most of
 * what a marketplace's browse page is for. The search box stays a real
 * `<form>` so it submits without JavaScript; the selects fall back to being
 * ordinary links.
 *
 * The last of these matters more than it looks: most of the work listed here
 * has no price, so an unfiltered grid reads as a gallery of things that
 * cannot be bought. "Ready to buy" is the switch that turns it back into a
 * shop.
 */
export function BrowseFilters({
  kinds,
  sorts,
  activeKind,
  activeSort,
  buyable,
  q,
}: {
  kinds: readonly { value: string; label: string }[];
  sorts: readonly { value: string; label: string }[];
  activeKind: string;
  activeSort: string;
  buyable: boolean;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const withParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      return `${pathname}?${next.toString()}`;
    },
    [params, pathname]
  );

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <nav aria-label="Kind of work" className="flex flex-wrap gap-1">
          {kinds.map((t) => {
            const active = activeKind === t.value;
            return (
              <Button
                key={t.value || "all"}
                asChild
                variant="ghost"
                className={
                  "h-auto min-h-9 rounded-full px-3.5 py-0 text-sm " +
                  (active
                    ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                    : "text-muted-foreground")
                }
              >
                <a
                  href={withParam("kind", t.value || null)}
                  aria-current={active ? "true" : undefined}
                >
                  {t.label}
                </a>
              </Button>
            );
          })}
        </nav>

        <a
          href="/gallery"
          className="ml-auto text-sm underline-offset-4 hover:underline"
        >
          Walk the 3D gallery →
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* `action={pathname}` rather than a hard-coded route: the catalogue
            now lives at the site root, and a form that posts somewhere else
            would bounce every no-JS search through a redirect. */}
        <form action={pathname} className="flex items-center gap-2">
          {activeKind && <input type="hidden" name="kind" value={activeKind} />}
          {activeSort !== "newest" && (
            <input type="hidden" name="sort" value={activeSort} />
          )}
          {buyable && <input type="hidden" name="buyable" value="1" />}
          <label htmlFor="q" className="sr-only">
            Search artworks
          </label>
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title or subject"
            className="h-10 w-56 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-muted-foreground">
            Sort
          </label>
          <select
            id="sort"
            value={activeSort}
            onChange={(e) => router.push(withParam("sort", e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={buyable}
            onChange={(e) => router.push(withParam("buyable", e.target.checked ? "1" : null))}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Ready to buy
          <span className="text-muted-foreground">(has a price)</span>
        </label>

        {(activeKind || buyable || q || activeSort !== "newest") && (
          <a href={pathname} className="text-sm underline underline-offset-4">
            Clear
          </a>
        )}
      </div>
    </div>
  );
}

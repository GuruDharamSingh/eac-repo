import Link from "next/link";
import type { OrgProfile } from "@elkdonis/services";

/**
 * The two standing sections under the chart: who reads them, and what has
 * been written.
 *
 * Both are plain cards rather than surface faces — there is no grid of tiles
 * on this page for them to belong to, and a face that opens nothing is just a
 * box with a shadow.
 */

export interface JournalEntry {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
}

export function AstrologersSection({ people }: { people: OrgProfile[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl">Astrologers</h2>
        <Link href="/services" className="text-sm text-primary underline underline-offset-4">
          Readings →
        </Link>
      </div>

      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No one is listed here yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {people.map((p) => (
            <li key={p.userId} className="flex items-start gap-4">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatarUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="grid size-14 shrink-0 place-items-center rounded-full bg-muted text-xl text-muted-foreground"
                  aria-hidden
                >
                  ◯
                </span>
              )}
              <div className="min-w-0">
                <Link
                  href={p.slug ? `/people/${p.slug}` : "/people"}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {p.displayName}
                </Link>
                {p.roleTitle && <div className="text-xs uppercase tracking-[0.14em] text-gold">{p.roleTitle}</div>}
                {p.headline && <p className="mt-1 text-sm text-muted-foreground">{p.headline}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function JournalSection({ entries }: { entries: JournalEntry[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl">Journal</h2>
        {entries.length > 0 && (
          <Link href="/journal" className="text-sm text-primary underline underline-offset-4">
            All writing →
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        // Honest rather than hopeful: there is no writing yet and no composer
        // to make any, so this says so instead of showing a hollow card.
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing written yet. Notes on transits, charts and the sky will appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {entries.map((e) => (
            <li key={e.id}>
              <Link href={`/journal/${e.slug}`} className="font-medium underline-offset-4 hover:underline">
                {e.title}
              </Link>
              {e.publishedAt && (
                <div className="text-xs tabular-nums text-muted-foreground">{e.publishedAt.slice(0, 10)}</div>
              )}
              {e.excerpt && <p className="mt-1 text-sm text-muted-foreground">{e.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

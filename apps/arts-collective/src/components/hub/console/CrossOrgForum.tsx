import { kindGlyph } from "@/lib/kind-glyph";
import type { CrossOrgForumItem } from "@/lib/org-forum";

/**
 * One board across every organisation the viewer belongs to.
 *
 * The console above it is about ONE org — whichever the switcher selected.
 * This is deliberately the opposite: someone in four orgs should not have to
 * visit four consoles to find out whether anything happened. It sits at the
 * bottom because it is the "and elsewhere" of the page, not its subject.
 *
 * Each row names its org, because in a cross-org list that is the first thing
 * you need and the one thing a single-org feed never has to say. Threads open
 * on the org's own site rather than here: that is where the thread actually
 * lives, and the console has no reader of its own.
 */

function when(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function CrossOrgForum({
  items,
  orgHomeUrls,
  orgCount,
}: {
  items: CrossOrgForumItem[];
  /** org slug → its public home, resolved server-side. */
  orgHomeUrls: Record<string, string>;
  orgCount: number;
}) {
  return (
    <section aria-label="Across your organizations" className="mt-12 border-t border-border pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Across your organizations
        </h2>
        <span className="text-xs text-muted-foreground">
          {orgCount === 1
            ? "everything in your org"
            : `everything in all ${orgCount} of your orgs`}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nothing posted yet in any of your organizations.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
          {items.map((item) => {
            const home = orgHomeUrls[item.orgSlug];
            const href = home && item.threadSlug ? `${home}/${item.threadSlug}` : null;

            const row = (
              <>
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-base text-muted-foreground"
                >
                  {kindGlyph(item.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-serif text-base leading-snug text-foreground">
                      {item.title}
                    </span>
                    {item.visibility === "ORGANIZATION" && (
                      <span className="rounded border border-border px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        members
                      </span>
                    )}
                  </span>
                  {item.excerpt && (
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">
                      {item.excerpt}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.orgName} · {item.kind}
                    {item.authorName && ` · ${item.authorName}`}
                    {item.replyCount > 0 &&
                      ` · ${item.replyCount} ${item.replyCount === 1 ? "reply" : "replies"}`}
                    {item.lastAt && ` · ${when(item.lastAt)}`}
                  </span>
                </span>
              </>
            );

            return (
              <li key={item.threadId}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    className="flex gap-3 p-4 transition-colors hover:bg-muted/40"
                  >
                    {row}
                  </a>
                ) : (
                  // No slug, or the org has no resolvable home: show the row
                  // rather than a link that would 404.
                  <div className="flex gap-3 p-4">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

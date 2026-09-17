import Link from "next/link";
import { isAdmin } from "@elkdonis/auth-server";
import { listQuotes } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import { QuotesManager } from "@/components/hub/QuotesManager";

/**
 * The quote desk — where the line on everybody's center comes from.
 *
 * A quote is the smallest thing on the network: no thread, no page, no
 * permalink (migration 127 says why). It exists to be read one at a time in
 * the band on /center, and this is the one place it is written and let
 * through.
 *
 * Two scopes. The collective's own lines show on EVERY organisation's center,
 * so only a platform admin may touch them. An organisation's own lines lead
 * on its own site and are its guides' business. Anyone signed in can still
 * send one in from the band on their center; those land here, waiting.
 */
export const dynamic = "force-dynamic";

const NETWORK = "network";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser("/login?next=/hub/quotes");
  const { org: orgParam } = await searchParams;

  const [editable, admin] = await Promise.all([
    getEditableOrgsForUser(user.id),
    isAdmin(user.id).catch(() => false),
  ]);

  // Every desk this person may stand at: the collective's for an admin, then
  // each org they guide.
  const scopes: Array<{ key: string; id: string | null; name: string }> = [
    ...(admin ? [{ key: NETWORK, id: null, name: "The collective" }] : []),
    ...editable.map((o) => ({ key: o.slug, id: o.id, name: o.name })),
  ];

  if (scopes.length === 0) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <h1 className="font-serif text-3xl">Quotes</h1>
          <p className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            You don&rsquo;t guide an organisation, so there is no desk here for you.
            You can still add a line from the band on your own center &mdash; a guide
            reads it before it joins the rotation.
          </p>
        </div>
      </SiteShell>
    );
  }

  const active = scopes.find((s) => s.key === orgParam) ?? scopes[0]!;
  const quotes = await listQuotes(active.id);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Organisation hub
          </p>
          <h1 className="mt-2 font-serif text-3xl">Quotes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The line that turns over on a person&rsquo;s center. The
            collective&rsquo;s lines show everywhere; an organisation&rsquo;s lead on
            its own site. Anyone signed in can send one in from the band, and it
            waits here until a guide puts it through.
          </p>
        </header>

        {scopes.length > 1 && (
          <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
            {scopes.map((s) => (
              <Link
                key={s.key}
                href={`/hub/quotes?org=${s.key}`}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active.key === s.key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {s.name}
              </Link>
            ))}
          </nav>
        )}

        <QuotesManager scope={active.id} scopeName={active.name} quotes={quotes} />
      </div>
    </SiteShell>
  );
}

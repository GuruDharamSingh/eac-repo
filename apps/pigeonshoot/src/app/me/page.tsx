import Link from "next/link";
import type { Metadata } from "next";
import { PigeonCard } from "@/components/pigeon-card";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { getGuest } from "@/lib/guest";
import { listCardsBySubmitter, listTiers } from "@/lib/data";

export const metadata: Metadata = { title: "Your shoots" };

/**
 * Everything this person has contributed, whether they have an account or not.
 * A guest sees their cards through the cookie; a signed-in user sees theirs
 * plus anything still attached to the guest id in this browser.
 */
export default async function MePage() {
  const [viewer, guest, tiers] = await Promise.all([
    getViewer().catch(() => null),
    getGuest(),
    listTiers(),
  ]);

  const cards = await listCardsBySubmitter({
    guestId: guest?.id ?? null,
    userId: viewer?.userId ?? null,
  });

  const unclaimed = Boolean(viewer && guest && !guest.linkedUserId);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Your shoots</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewer
              ? `Signed in as ${viewer.email}`
              : guest
                ? `Posting as ${guest.displayName} — tied to this browser`
                : "Nothing yet"}
          </p>
        </div>
        <div className="flex gap-2">
          {viewer?.canEdit && (
            <Button asChild variant="outline">
              <Link href="/manage">Manage the site</Link>
            </Button>
          )}
          {viewer ? (
            <SignOutButton />
          ) : (
            <Button asChild variant="outline">
              <Link href="/login?mode=signup">Make an account</Link>
            </Button>
          )}
        </div>
      </header>

      {unclaimed && (
        <p className="mt-6 rounded-lg border border-primary/40 bg-accent p-4 text-sm text-accent-foreground">
          This browser has anonymous cards that aren&apos;t linked to your account yet.
          They&apos;ll be attached the next time you submit while signed in.
        </p>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-14 text-center">
          <p className="text-muted-foreground">You haven&apos;t shot anything yet.</p>
          <Button asChild className="mt-4">
            <Link href="/submit">Go find a pigeon</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.id}>
              <PigeonCard
                card={card}
                tiers={tiers}
                variant="compact"
                href={`/cards/${card.slug}`}
              />
              {card.moderationState !== "live" && (
                <p className="mt-1 text-xs text-destructive">
                  {card.moderationState === "hidden" ? "Hidden by a moderator" : "Removed"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import {
  listOrgAgreements,
  listAgreementsForMember,
  listAcceptances,
} from "@elkdonis/services/agreements";
import { getOrgsForUser } from "@/lib/agreements-data";
import {
  AgreementsManager,
  MemberAgreements,
  type AcceptanceRow,
} from "@/components/hub/AgreementsManager";

/**
 * Agreements — the terms an organisation offers its members, and the record of
 * who accepted which version.
 *
 * This is not paperwork sitting beside commerce; it IS the commerce rule. An
 * org may take a share of a member's sale only where that member accepted an
 * agreement with it. No acceptance means no claim, whatever the sale was sold
 * through. See packages/services/src/agreements.ts.
 *
 * Lives on the org hub rather than in art-auction because agreements govern
 * everything sold through an org — workshops, services and products as much as
 * artwork — and art-auction is only one of the fronts.
 *
 * Two audiences on one page, deliberately: an owner needs to see what they are
 * asking of people, and everyone needs to see what they have been asked.
 */
export const dynamic = "force-dynamic";

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser("/login?next=/hub/agreements");
  const { org: orgParam } = await searchParams;

  const [editable, memberOf] = await Promise.all([
    getEditableOrgsForUser(user.id),
    getOrgsForUser(user.id),
  ]);
  const owned = editable.filter((o) => o.role === "owner");

  // The org being administered: the one asked for, else the first owned.
  const active = orgParam
    ? owned.find((o) => o.id === orgParam || o.slug === orgParam)
    : owned[0];

  const [orgAgreements, acceptances] = active
    ? await Promise.all([
        listOrgAgreements(active.id),
        (async () => {
          const rows = await Promise.all(
            (await listOrgAgreements(active.id)).map(async (a) =>
              (await listAcceptances(a.id)).map((x) => ({
                agreementId: a.id,
                userId: x.userId,
                displayName: x.displayName,
                email: x.email,
                acceptedAt: x.acceptedAt,
                revokedAt: x.revokedAt,
              }))
            )
          );
          return rows.flat() as AcceptanceRow[];
        })(),
      ])
    : [[], [] as AcceptanceRow[]];

  // What every org this person belongs to is asking of them — including orgs
  // they do not administer, which is the common case for an artist.
  const asked = await Promise.all(
    memberOf.map(async (o) => ({
      org: o,
      agreements: (await listAgreementsForMember(o.id, user.id)).filter(
        (a) => a.requiresAcceptance
      ),
    }))
  );
  const withAsks = asked.filter((a) => a.agreements.length > 0);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-5xl space-y-12 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Organisation hub
          </p>
          <h1 className="mt-2 font-serif text-3xl">Agreements</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            An organisation can only take a share of what a member sells if that
            member has accepted an agreement with it. Everything else &mdash;
            artwork, workshops, services &mdash; settles to the person who made
            it.
          </p>
        </header>

        {owned.length > 1 && (
          <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
            {owned.map((o) => (
              <Link
                key={o.id}
                href={`/hub/agreements?org=${o.slug}`}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active?.id === o.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {o.name}
              </Link>
            ))}
          </nav>
        )}

        {active ? (
          <AgreementsManager
            orgId={active.id}
            orgName={active.name}
            agreements={orgAgreements}
            acceptances={acceptances}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            You don&rsquo;t own an organisation, so there is nothing to author
            here. Anything you have been asked to agree to appears below.
          </p>
        )}

        {withAsks.length > 0 && (
          <div className="space-y-10 border-t border-border pt-10">
            {withAsks.map(({ org, agreements }) => (
              <MemberAgreements
                key={org.id}
                orgName={org.name}
                agreements={agreements}
              />
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import { getStoreForOrg, listStoreMembers, listStoreArtworks } from "@elkdonis/commerce/queries";
import { listOrgBeneficiaries, listActivePayees, listSuggestedPayees } from "@elkdonis/commerce/server";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import { MARKETPLACE_ORG } from "./marketplace";
import { HubStorePanels, OpenStoreButton } from "./store-panels";
import "@elkdonis/cms-ui/store.css";

/**
 * /hub/store?org=<slug> — an organisation's store on the marketplace: its
 * team (who may list and sell) and its beneficiaries (where a listing's
 * money may go). Owners and guides of the org. Same panels as an org site's
 * manage page (IFAC /manage/store); ORG_STORE_BRIEF D2, D5, R9.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Organisation store", robots: { index: false } };

const MARKET = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

export default async function HubStorePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser("/login?next=/hub/store");
  const { org: orgParam } = await searchParams;
  const orgs = await getEditableOrgsForUser(user.id);
  const selected = orgs.find((o) => o.slug === orgParam || o.id === orgParam) ?? orgs[0] ?? null;

  if (!selected) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <p className="text-sm text-muted-foreground">
            You do not own or administer an organisation here.{" "}
            <Link className="underline underline-offset-4" href="/hub">
              Back to the hub
            </Link>
          </p>
        </div>
      </SiteShell>
    );
  }

  const store = await getStoreForOrg(selected.id, MARKETPLACE_ORG);
  const links = marketplaceLinks(MARKET, { from: "hub", handoff: true });

  const [members, beneficiaries, suggested, allPayees, artworks] = store
    ? await Promise.all([
        listStoreMembers(store.id),
        listOrgBeneficiaries(selected.id),
        listSuggestedPayees(selected.id),
        listActivePayees(),
        listStoreArtworks(store.id).catch(() => []),
      ])
    : [[], [], [], [], []];
  const listed = new Set(beneficiaries.map((b) => b.id));
  const addableOrgs = allPayees.filter((p) => p.kind === "org" && !listed.has(p.id));

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Link href={`/hub/organization?org=${selected.slug}`} className="underline-offset-4 hover:underline">
              {selected.name}
            </Link>
          </p>
          <h1 className="mt-2 font-serif text-3xl">Store</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {selected.name}&rsquo;s store on the marketplace: who may list and sell in it, and
            where a listing&rsquo;s money may be directed.
          </p>
          {orgs.length > 1 && (
            <p className="mt-3 flex flex-wrap gap-2 text-xs">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/hub/store?org=${o.slug}`}
                  className={
                    o.id === selected.id
                      ? "rounded-full border border-foreground px-3 py-1"
                      : "rounded-full border border-border px-3 py-1 text-muted-foreground"
                  }
                >
                  {o.name}
                </Link>
              ))}
            </p>
          )}
        </header>

        {!store ? (
          <section className="space-y-3 rounded-lg border border-dashed border-border p-6">
            <p className="text-sm text-muted-foreground">
              {selected.name} has no store on the marketplace yet. Opening one lets its owners and
              admins list work the organisation holds under its name, with the proceeds recorded
              to the organisation.
            </p>
            <OpenStoreButton orgId={selected.id} orgName={selected.name} />
          </section>
        ) : (
          <>
            <section className="text-sm">
              <p className="text-muted-foreground">
                {artworks.length === 0
                  ? "Nothing listed yet."
                  : `${artworks.length} piece${artworks.length === 1 ? "" : "s"} listed.`}{" "}
                Listings are added and edited on the marketplace by the store team.
              </p>
              <p className="mt-2 flex flex-wrap gap-4">
                <a className="underline underline-offset-4" href={store.slug ? links.store(store.slug) : links.browse} target="_blank" rel="noopener">
                  Storefront →
                </a>
                <a className="underline underline-offset-4" href={`${MARKET}/studio`} target="_blank" rel="noopener">
                  List a piece (My art) →
                </a>
              </p>
            </section>
            <HubStorePanels
              orgId={selected.id}
              orgName={selected.name}
              members={members.map((m) => ({ userId: m.userId, role: m.role, displayName: m.displayName, email: m.email }))}
              beneficiaries={beneficiaries.map((p) => ({
                id: p.id, kind: p.kind, name: p.name, registrationNo: p.registrationNo, website: p.website, blurb: p.blurb,
              }))}
              suggested={suggested.map((p) => ({ id: p.id, kind: p.kind, name: p.name, website: p.website }))}
              addableOrgs={addableOrgs.map((p) => ({ id: p.id, kind: p.kind, name: p.name }))}
              selfUserId={user.id}
            />
          </>
        )}
      </div>
    </SiteShell>
  );
}

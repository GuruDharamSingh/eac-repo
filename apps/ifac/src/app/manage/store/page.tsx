import { requireIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";
import { getStoreForOrg, listStoreMembers, listStoreArtworks } from "@elkdonis/commerce/queries";
import { listOrgBeneficiaries, listActivePayees, listSuggestedPayees } from "@elkdonis/commerce/server";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import { MARKETPLACE_ORG } from "@/lib/cms/marketplace";
import { StorePanels, OpenStoreButton } from "@/components/manage/store-panels";
import "@elkdonis/cms-ui/store.css";

export const metadata = { title: "Store — IFAC" };
export const dynamic = "force-dynamic";

/**
 * IFAC's own store on the marketplace: who may list and sell in it, and the
 * charities and organisations its listings may direct money to
 * (ORG_STORE_BRIEF D2, D5, R9). The listings themselves are edited on the
 * marketplace, where the artwork form lives.
 */
export default async function ManageStorePage() {
  const viewer = await requireIfacManager("/manage/store");
  const store = await getStoreForOrg(siteConfig.orgId, MARKETPLACE_ORG);
  const links = marketplaceLinks(siteConfig.marketplaceUrl, { from: "ifac", handoff: true });

  if (!store) {
    return (
      <section className="admin-panel">
        <h2>IFAC&rsquo;s store</h2>
        <p className="body-copy">
          IFAC has no store on the marketplace yet. Opening one lets owners and admins list
          work the organisation holds — donated pieces, collective prints — under IFAC&rsquo;s
          name, with the proceeds recorded to IFAC.
        </p>
        <OpenStoreButton />
      </section>
    );
  }

  const [members, beneficiaries, suggested, allPayees, artworks] = await Promise.all([
    listStoreMembers(store.id),
    listOrgBeneficiaries(siteConfig.orgId),
    listSuggestedPayees(siteConfig.orgId),
    listActivePayees(),
    listStoreArtworks(store.id).catch(() => []),
  ]);
  const listed = new Set(beneficiaries.map((b) => b.id));
  const addableOrgs = allPayees.filter((p) => p.kind === "org" && !listed.has(p.id));

  return (
    <>
      <section className="admin-panel">
        <h2>IFAC&rsquo;s store</h2>
        <p className="body-copy">
          {artworks.length === 0
            ? "Nothing listed yet. "
            : `${artworks.length} piece${artworks.length === 1 ? "" : "s"} listed. `}
          Listings are added and edited on the marketplace, signed in as a member of the store
          team.
        </p>
        <p>
          <a className="btn-link" href={store.slug ? links.store(store.slug) : links.browse} target="_blank" rel="noopener">
            Open IFAC&rsquo;s storefront →
          </a>{" "}
          <a className="btn-link" href={`${siteConfig.marketplaceUrl}/studio`} target="_blank" rel="noopener">
            List a piece (My art) →
          </a>
        </p>
      </section>

      <StorePanels
        members={members.map((m) => ({
          userId: m.userId,
          role: m.role,
          displayName: m.displayName,
          email: m.email,
        }))}
        beneficiaries={beneficiaries.map((p) => ({
          id: p.id,
          kind: p.kind,
          name: p.name,
          registrationNo: p.registrationNo,
          website: p.website,
          blurb: p.blurb,
        }))}
        suggested={suggested.map((p) => ({ id: p.id, kind: p.kind, name: p.name, website: p.website }))}
        addableOrgs={addableOrgs.map((p) => ({ id: p.id, kind: p.kind, name: p.name }))}
        selfUserId={viewer.userId}
      />
    </>
  );
}

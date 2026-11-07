import { BusinessesSteward } from "@/components/manage/businesses-steward";
import { listBusinessClaimsAction, listStewardBusinessesAction } from "@/lib/business-actions";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Business listings this org stewards: claims, removal requests, and every listing (editors; manage/layout gates it). */
export default async function ManageBusinessesPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [listings, claims] = await Promise.all([listStewardBusinessesAction(), listBusinessClaimsAction()]);
  return (
    <>
      <h2 className="font-serif text-2xl">Businesses</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Unclaimed listings for the shops, cafés and venues on the tours, kept by {`Elkdonis Tours & Experiences`} until their owners claim them.
      </p>
      <div className="mt-6">
        <BusinessesSteward listings={listings} claims={claims} />
      </div>
    </>
  );
}

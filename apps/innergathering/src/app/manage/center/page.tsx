import { getCenterPromo } from "@elkdonis/services";
import { CenterPromoEditor } from "@/components/manage/center-promo-editor";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

/**
 * What /center shows that is not content: the promotion slot. The layout
 * gate (requireOrgEditor) admits owners and guides only.
 *
 * Only a hand-written (`link`) placement is edited here. A placement of
 * another kind (thread, artist, store — set by hand in site_config) is shown
 * as taken and can be cleared, not edited.
 */
export default async function ManageCenterPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const promo = await getCenterPromo(siteConfig.orgId);
  const editable =
    promo?.kind === "link"
      ? { title: promo.title ?? "", body: promo.blurb ?? "", href: promo.href ?? "", imageUrl: promo.image_url ?? "" }
      : null;

  return (
    <>
      <h2 className="font-serif text-2xl">Center</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        The signed-in home on this site. Its layout is set from the network hub; the promotion is set here.
      </p>
      {promo && promo.kind !== "link" && (
        <p className="mt-4 text-sm text-muted-foreground">
          A {promo.kind} placement ({promo.ref}) is set directly in site_config. Saving here replaces it.
        </p>
      )}
      <div className="mt-6">
        <CenterPromoEditor initial={editable} placed={Boolean(promo)} />
      </div>
    </>
  );
}

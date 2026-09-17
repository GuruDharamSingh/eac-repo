import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { renderDossierFromDisk } from "@elkdonis/cms-bindings/node";
import { visibleDossierSections } from "@elkdonis/cms-bindings/dossier";
import {
  getDossierProfile,
  getFullDossier,
  getDossierMeta,
  listDossierSlugs,
  hasVouched,
  isOadSteward,
  dossierEditValues,
} from "@/lib/oad";
import { getCurrentUser } from "@/lib/session";
import { DossierActions } from "@/components/oad/DossierActions";
import { DossierActivity } from "@/components/oad/DossierActivity";
import { DossierSidebar } from "@/components/oad/DossierSidebar";
import { StandardProfile } from "@/components/oad/StandardProfile";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getProfileBySlug } from "@elkdonis/services";
import {
  getStoreForUser,
  getStoreShowcaseForUser,
  hasProfileSection,
} from "@elkdonis/commerce/queries";
import { resolveLayout } from "@/lib/profile-layouts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listDossierSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDossierProfile(slug);
  if (!profile) return {};
  return {
    title: `${profile.name} — ArtDirect Dossier`,
    description: profile.bio ?? `Dossier on ${profile.name}.`,
  };
}

export default async function DossierPage({ params }: Props) {
  const { slug } = await params;
  const [meta, user] = await Promise.all([getDossierMeta(slug), getCurrentUser()]);
  if (!meta) notFound();

  // Their drafts are only ever unlocked by the viewer BEING them; there is no
  // flag for it. See getAuthoredThreads.
  const viewerId = user?.id;
  const profile = await getFullDossier(slug, { viewerId });
  if (!profile) notFound();

  const [steward, vouched] = await Promise.all([
    user ? isOadSteward(user.id) : Promise.resolve(false),
    user ? hasVouched(meta.id, user.id) : Promise.resolve(false),
  ]);

  // The person chooses how their own page is rendered — users.profile_layout.
  // resolveLayout falls back rather than throwing, so a value written before a
  // layout was retired still renders something.
  const identity = await getProfileBySlug(slug);
  const layout = resolveLayout(identity?.profileLayout);

  // Their marketplace store, if one is active: the store is a front for this
  // profile, so this is where a visitor learns the work is for sale. Shown
  // only when the person has switched the section on (profile_sections).
  const marketplaceUrl = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";
  const uid = identity?.userId ?? null;
  const [ownStore, storeSectionOn] = uid
    ? await Promise.all([
        getStoreForUser(uid).catch(() => null),
        hasProfileSection(uid, "store"),
      ])
    : [null, false];
  const hasStore = ownStore?.status === "active";
  const storeShowcase =
    hasStore && storeSectionOn && uid
      ? await getStoreShowcaseForUser(uid, { limit: 6 }).catch(() => null)
      : null;
  const useTemplate = layout !== "standard";
  const isSelf = Boolean(identity?.userId && user?.id === identity.userId);

  // The nav and the file are rendered apart so the owner's sidebar can sit
  // between them, on the folder — it is about the file, not part of it.
  const navHtml = useTemplate
    ? renderDossierFromDisk(profile, { navOnly: true, archiveName: "ArtDirect", indexHref: "/" })
    : null;
  const fileHtml = useTemplate
    ? renderDossierFromDisk(profile, { includeNav: false, includeFolder: false })
    : null;

  // The owner's panel. Rendered on BOTH layouts, because switching between them
  // is one of the things it does — offering it only on the dossier would make
  // the plain page a one-way door.
  const sidebar =
    isSelf && identity ? (
      <DossierSidebar
        profileUserId={identity.userId}
        slug={slug}
        values={dossierEditValues(identity)}
        sections={profile.sections ?? {}}
        visibleSections={[...visibleDossierSections(profile)]}
        layout={layout}
        hasStore={hasStore}
        marketplaceUrl={marketplaceUrl}
        networkUrl={process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007"}
      />
    ) : null;

  return (
    <>
      {/* The dossier template carries its own fixed look, so a person's palette
          only reaches the standard page. */}
      <ThemeStyle userId={identity?.userId ?? null} precedence="user" />
      {useTemplate ? (
        <>
          {/* eslint-disable-next-line @next/next/no-head-element */}
          <link rel="stylesheet" href="/api/silex/templates/dossier.css" />
          <div dangerouslySetInnerHTML={{ __html: navHtml! }} />
          {/* Filed activity is rendered INSIDE the file by the template. It
              used to be a React sibling of the sheet, sitting on the desk and
              inheriting the file's near-black ink — about 1.07:1, so it was
              present in the DOM and invisible on every dossier. */}
          <div className="eac-dossier-folder">
            <div dangerouslySetInnerHTML={{ __html: fileHtml! }} />
          </div>
        </>
      ) : (
        identity && (
          <>
            <StandardProfile
              profile={identity}
              isSelf={isSelf}
              store={storeShowcase}
              hasStore={hasStore}
              storeSectionOn={storeSectionOn}
              marketplaceUrl={marketplaceUrl}
            />
            {/* The standard layout has no equivalent section of its own yet. */}
            <div style={{ paddingBottom: 64 }}>
              <DossierActivity userId={meta.id} viewerId={user?.id} />
            </div>
          </>
        )
      )}
      <DossierActions
        slug={slug}
        signedIn={Boolean(user)}
        isSteward={steward}
        claimStatus={meta.claim_status}
        verified={meta.verified}
        vouchCount={meta.vouch_count}
        alreadyVouched={vouched}
        loginUrl={`/login?redirect=/${slug}`}
      />
      {sidebar}
    </>
  );
}

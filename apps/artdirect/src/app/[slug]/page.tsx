import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
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
  contactHref,
} from "@/lib/oad";
import { getCurrentUser } from "@/lib/session";
import { DossierActions } from "@/components/oad/DossierActions";
import { DossierSidebar } from "@/components/oad/DossierSidebar";
import { ManageSpace } from "@/components/oad/ManageSpace";
import { PersonDrawer } from "@/components/oad/PersonDrawer";
import { GalleryPanel } from "@/components/oad/GalleryPanel";
import { ProfileEditorPanel } from "@/components/oad/ProfileEditorPanel";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import {
  PERSONAL_ORG_ID,
  getPersonPage,
  getProfileBySlug,
  listOrgHomes,
  listProfileOrgs,
  personThreadHref,
  servicePriceLabel,
  type PersonThread,
  type Profile,
  getFeaturedOffering,
  resolvePersonSections,
  resolveTheme,
} from "@elkdonis/services";
import {
  PersonPage,
  PersonGalleryCards,
  PersonSectionPanel,
  PersonThreadList,
} from "@elkdonis/cms-ui/profile";
import { WritingSection } from "@elkdonis/cms-ui/writing";
import { StoreShowcase } from "@elkdonis/commerce/components";
import {
  getStoreForUser,
  getStoreShowcaseForUser,
  hasProfileSection,
} from "@elkdonis/commerce/queries";
import { resolveLayout } from "@/lib/profile-layouts";
import { loadPublishedUserPage } from "@elkdonis/page-builder/server";
import { PERSON_PAGE_ORG, documentTitle, knownTypesFor, liveKey, loadPersonContext } from "@/lib/person-pages";
import { PersonDoc, resolvePersonDoc } from "@/components/design/PersonDoc";

export const dynamic = "force-dynamic";

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";
// Gallery pages are served by IFAC today; same target as lib/oad.ts exhibits.
const IFAC_URL = process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008";

function day(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A post or event as a list row: linked on its home site, "on <org>". */
function threadItem(t: PersonThread, when: string | null) {
  return {
    href: personThreadHref(t, { networkUrl: NETWORK_URL }),
    title: t.title,
    meta: [when, t.location, `on ${t.orgName}`].filter(Boolean).join(" · "),
    excerpt: t.excerpt,
    external: true,
    draft: t.status !== "published",
  };
}

/**
 * A service as a list row. One homed on ArtDirect (`oad`) is booked here, at
 * /<slug>/services/<service>; one homed on an org is booked on that org's site.
 */
function serviceItem(t: PersonThread, personKey: string) {
  const local = t.orgId === PERSONAL_ORG_ID;
  return {
    href: local ? `/${personKey}/services/${t.slug}` : personThreadHref(t, { networkUrl: NETWORK_URL }),
    title: t.title,
    meta: [servicePriceLabel(t), local ? null : `on ${t.orgName}`].filter(Boolean).join(" · "),
    excerpt: t.excerpt,
    external: !local,
    draft: t.status !== "published",
  };
}

/**
 * users.directory_listed = false keeps a person off the directory, and their
 * page answers 404 to visitors. They themselves and stewards (which include
 * global admins) still see it.
 */
function hiddenFrom(identity: Profile, viewerId: string | null | undefined, steward: boolean): boolean {
  if (identity.directoryListed) return false;
  if (viewerId && viewerId === identity.userId) return false;
  return !steward;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listDossierSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // An unlisted person's name is not handed to crawlers; the page itself
  // decides whether the viewer sees it.
  const identity = await getProfileBySlug(slug);
  if (!identity || !identity.directoryListed) return {};
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
  if (!identity || hiddenFrom(identity, viewerId, steward)) notFound();
  const layout = resolveLayout(identity.profileLayout);

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
  // Strict match: admins do not get the inline tools here, although
  // ProfileEditorPanel's note allows for them (brief, "Found during the survey").
  const isSelf = Boolean(identity?.userId && user?.id === identity.userId);

  // The person's designed pages (user_pages, org `oad`; /<slug>/design and
  // /<slug>/featured/design). A published profile document replaces the
  // standard layout; the dossier layout is left as it is. A published
  // featured page is linked near the top of either standard page.
  const [profileDoc, featuredDoc] =
    uid && (!useTemplate || isSelf)
      ? await Promise.all([
          useTemplate
            ? Promise.resolve(null)
            : loadPublishedUserPage(uid, PERSON_PAGE_ORG, liveKey("profile"), knownTypesFor("profile")).catch(() => null),
          loadPublishedUserPage(uid, PERSON_PAGE_ORG, liveKey("featured")).catch(() => null),
        ])
      : [null, null];
  // A featured OFFERING (migration 171) is linked when there is no designed
  // featured page; /<slug>/featured renders it.
  const featuredOffering =
    uid && !featuredDoc ? await getFeaturedOffering(uid).catch(() => null) : null;
  const featuredLink = featuredOffering ? (
    <p className="oad-person-featured-link">
      <a href={`/${slug}/featured`}>Featured: {featuredOffering.title} →</a>
    </p>
  ) : featuredDoc ? (
    <p className="oad-person-featured-link">
      <a href={`/${slug}/featured`}>
        {documentTitle(featuredDoc.data) ? `Featured: ${documentTitle(featuredDoc.data)} →` : "Featured →"}
      </a>
    </p>
  ) : null;
  const designed = profileDoc
    ? await renderDesigned({ slug, identity, viewerId, isSelf, hasStore, storeSectionOn, marketplaceUrl, data: profileDoc.data, featuredLink })
    : null;

  const standard = useTemplate || designed
    ? null
    : await renderStandard({ slug, identity, viewerId, isSelf, hasStore, storeSectionOn, storeShowcase, marketplaceUrl, featuredLink });

  // The nav and the file are rendered apart so the owner's sidebar can sit
  // between them, on the folder — it is about the file, not part of it.
  const navHtml = useTemplate
    ? renderDossierFromDisk(profile, { navOnly: true, archiveName: "ArtDirect", indexHref: "/" })
    : null;
  const fileHtml = useTemplate
    ? renderDossierFromDisk(profile, { includeNav: false, includeFolder: false })
    : null;

  // The drawer's owner controls: section order (users.profile_section_order)
  // and page background (users.theme --oad-page-bg). Read only for the owner.
  const [drawerSections, pageBackground] =
    isSelf && uid
      ? await Promise.all([
          resolvePersonSections(uid, PERSONAL_ORG_ID)
            // `portfolio` is PersonPage's featured-work column beside the bio,
            // not a section in the flow (PersonPage.tsx:180), so ordering it
            // would do nothing; it is left out of the list.
            .then((list) => list.filter((s) => s.key !== "portfolio").map((s) => ({ key: s.key, label: s.label, on: s.on })))
            .catch(() => []),
          resolveTheme({ userId: uid, precedence: "user" })
            .then((vars) => vars["--oad-page-bg"] ?? null)
            .catch(() => null),
        ])
      : [[], null];

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
        networkUrl={NETWORK_URL}
        design={{
          profileHref: `/${slug}/design`,
          featuredHref: `/${slug}/featured/design`,
          featuredLiveHref: featuredDoc ? `/${slug}/featured` : null,
          profileLive: Boolean(profileDoc),
        }}
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
        designed ?? standard
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
      {/* The left drawer: who this is and how to reach them; for the person
          themselves, writing, Studio, the hub, section order and background. */}
      {identity ? (
        <PersonDrawer
          slug={slug}
          displayName={identity.displayName}
          portraitUrl={identity.avatarUrl}
          bio={identity.bio ? plainText(identity.bio) : null}
          contactHref={contactHref(identity)}
          isOwner={isSelf}
          networkUrl={NETWORK_URL}
          sections={drawerSections}
          pageBackground={pageBackground}
        />
      ) : null}
      {/* "Manage your space": offerings, the featured one, start a group. */}
      {isSelf && identity ? (
        <ManageSpace
          slug={slug}
          displayName={identity.displayName ?? null}
          startGroupHref={`${NETWORK_URL}/hub/organization`}
          writingHref={`/${slug}/writing`}
          bookingsHref={`${NETWORK_URL}/hub/bookings`}
        />
      ) : null}
    </>
  );
}

/**
 * The `standard` layout: the shared PersonPage over getPersonPage with the
 * personal org, i.e. everything the person authored that the viewer may read
 * (docs/open/PERSON_PAGES_BRIEF_2026-09-26.md, decisions 4 and 5). Threads
 * link to their home sites; writing reads at /<slug>/writing.
 */
async function renderStandard({
  slug,
  identity,
  viewerId,
  isSelf,
  hasStore,
  storeSectionOn,
  storeShowcase,
  marketplaceUrl,
  featuredLink,
}: {
  slug: string;
  identity: Profile;
  viewerId: string | undefined;
  isSelf: boolean;
  hasStore: boolean;
  storeSectionOn: boolean;
  storeShowcase: Awaited<ReturnType<typeof getStoreShowcaseForUser>> | null;
  marketplaceUrl: string;
  /** Link to their published featured page, under the role; null when none. */
  featuredLink: ReactNode;
}) {
  const [page, memberships, homes] = await Promise.all([
    getPersonPage(slug, { orgId: PERSONAL_ORG_ID, viewerId }),
    listProfileOrgs(identity.userId, { onlyPublic: true }),
    listOrgHomes(),
  ]);
  if (!page) return null;
  const { profile } = page;
  const key = profile.slug ?? profile.userId;

  const galleryItems = page.portfolio.map((item, i) => ({
    id: item.id ?? `${key}-${i}`,
    url: item.url,
    title: item.title,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));

  const homeByOrgId = new Map(
    homes.map((h) => [
      h.orgId,
      h.primaryDomain ? `https://${h.primaryDomain}` : `${NETWORK_URL}/sites/${h.orgSlug}`,
    ])
  );
  const orgs = memberships.filter((o) => o.orgId !== PERSONAL_ORG_ID);

  const slots: Record<string, ReactNode> = {
    galleries: (
      <PersonGalleryCards
        items={page.galleries.map((g) => ({
          href: `${IFAC_URL}/artists/${key}/galleries/${g.slug}`,
          title: g.title,
          coverUrl: g.coverUrl,
          meta: g.itemCount ? `${g.itemCount} ${g.itemCount === 1 ? "work" : "works"}` : null,
          draft: !g.isPublic,
        }))}
      />
    ),
    blog: (
      <WritingSection
        items={page.writing}
        basePath={`/${key}/writing`}
        editable={page.canEdit}
      />
    ),
    services: (
      <PersonThreadList
        title="Services"
        items={page.services.map((t) => serviceItem(t, key))}
        empty={page.canEdit ? "No services yet. Offer one from Manage your space." : null}
      />
    ),
    posts: (
      <PersonThreadList
        title="Posts"
        items={page.posts.map((t) => threadItem(t, day(t.publishedAt)))}
        empty={page.canEdit ? "Nothing posted yet." : null}
      />
    ),
    events: (
      <PersonThreadList
        title="Events"
        items={page.events.map((t) => threadItem(t, day(t.scheduledAt)))}
        empty={page.canEdit ? "No events yet." : null}
      />
    ),
    store: storeShowcase ? (
      <StoreShowcase
        store={storeShowcase.store}
        artworks={storeShowcase.artworks}
        marketplaceUrl={marketplaceUrl}
        from="artdirect"
        className="eac-profile-store"
      />
    ) : null,
  };

  return (
    <PersonPage
      className="oad-person eac-person-page--frame"
      person={{
        displayName: profile.displayName,
        role: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        verified: profile.verified,
        socialLinks: profile.socialLinks,
      }}
      back={{ href: "/", label: "← ArtDirect" }}
      intro={featuredLink ?? undefined}
      editor={
        isSelf ? (
          <ProfileEditorPanel
            profileUserId={profile.userId}
            slug={key}
            bio={profile.bio ?? ""}
            avatarUrl={profile.avatarUrl ?? ""}
            hasStore={hasStore}
            storeSectionOn={storeSectionOn}
            marketplaceUrl={marketplaceUrl}
          />
        ) : null
      }
      featured={
        galleryItems.length > 0 || isSelf ? (
          <GalleryPanel profileUserId={profile.userId} slug={key} items={galleryItems} editable={isSelf} />
        ) : null
      }
      order={page.sections.filter((s) => s.on).map((s) => s.key)}
      slots={slots}
      after={
        orgs.length > 0 ? (
          <div className="eac-person-slot" data-person-section="memberships">
            <PersonSectionPanel title="Member of">
              <ul className="eac-person-list">
                {orgs.map((o) => (
                  <li key={o.orgId}>
                    <a href={homeByOrgId.get(o.orgId) ?? `${NETWORK_URL}/sites/${o.orgSlug}`}>{o.orgName}</a>
                    {o.roleTitle && <p className="eac-person-meta">{o.roleTitle}</p>}
                  </li>
                ))}
              </ul>
            </PersonSectionPanel>
          </div>
        ) : null
      }
    />
  );
}

/**
 * A published profile document (the person's own design of this page), in
 * the same frame as the standard layout. Null when it cannot be resolved, so
 * the caller falls back to the standard layout rather than failing the page.
 */
async function renderDesigned({
  slug,
  identity,
  viewerId,
  isSelf,
  hasStore,
  storeSectionOn,
  marketplaceUrl,
  data,
  featuredLink,
}: {
  slug: string;
  identity: Profile;
  viewerId: string | undefined;
  isSelf: boolean;
  hasStore: boolean;
  storeSectionOn: boolean;
  marketplaceUrl: string;
  data: unknown;
  featuredLink: ReactNode;
}) {
  const context = await loadPersonContext(slug, viewerId);
  if (!context) return null;
  const resolved = await resolvePersonDoc("profile", data, context);
  if (!resolved) return null;
  const key = identity.slug ?? identity.userId;
  return (
    <div className="eac-person-page eac-person-page--frame oad-person" data-person-page="" data-person-doc="profile">
      <nav className="eac-person-intro oad-person-bar" aria-label="Page">
        <a className="eac-person-back" href="/">
          ← ArtDirect
        </a>
        {featuredLink}
      </nav>
      {isSelf ? (
        <div className="eac-person-editor">
          <ProfileEditorPanel
            profileUserId={identity.userId}
            slug={key}
            bio={identity.bio ?? ""}
            avatarUrl={identity.avatarUrl ?? ""}
            hasStore={hasStore}
            storeSectionOn={storeSectionOn}
            marketplaceUrl={marketplaceUrl}
          />
        </div>
      ) : null}
      <PersonDoc kind="profile" data={resolved} context={context} />
    </div>
  );
}

/** A bio for the drawer: tags dropped, entities for the common few decoded, whitespace kept. */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

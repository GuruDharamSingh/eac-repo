import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import {
  getPersonPage,
  getThemeOverrides,
  personThreadHref,
  type PersonThread,
} from "@elkdonis/services";
import { PersonPage, PersonThreadList, type PersonListItem } from "@elkdonis/cms-ui/profile";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
// The /rsc entry explicitly, not the bare specifier — see the note on every
// other route in this repo that renders Puck data: Next only resolves the
// server Render via the package's react-server export condition, and
// getting this wrong ships the whole editor bundle to every visitor.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { STORE_PANEL_BLOCKS } from "@elkdonis/blocks";
import { storePanelServerResolvers } from "@elkdonis/blocks/server";
import { buildPuckConfig } from "@elkdonis/page-builder";
import { loadPublishedUserPage } from "@elkdonis/page-builder/server";
import { siteConfig } from "@/config/site";
import { getDirectoryProfile, toIFACProfile } from "@/lib/directory";
import { threadHref } from "@/lib/gather";
import { FRAME_THEME_VARS } from "@/lib/theme-tokens";
import { defaultSiteContent } from "@/lib/default-content";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ClaimPrompt } from "@/components/claim-prompt";
import { ProfileEditorPanel } from "@/components/profile-editor-panel";
import { GalleryPanel } from "@/components/gallery-panel";
import { GalleriesSection } from "@/components/galleries-section";
import { WritingSection } from "@/components/writing-section";
import { ElkdonisFeed } from "@/components/elkdonis-feed";

/**
 * A person's page on IFAC: /artists/<slug> and /dealers/<slug>.
 *
 * Both routes render through the shared PersonPage
 * (@elkdonis/cms-ui/profile) over getPersonPage (@elkdonis/services); see
 * docs/open/PERSON_PAGES_BRIEF_2026-09-26.md. What stays here is IFAC's:
 * the claim prompt, the inline editor, the editable featured-work grid,
 * the gallery and writing sections with their owner tools, the store panel
 * and the network feed, all passed in as slots.
 *
 * Artist vs dealer is `org_profiles.tags` containing `dealer`; every other
 * row is an artist (lib/directory.ts). A profile that is not public on IFAC
 * is a 404 for every viewer, the owner included, as before this module.
 */

export type PersonKind = "artists" | "dealers";

const COPY: Record<PersonKind, {
  back: { href: string; label: string };
  empty: string;
  emailSubject: (name: string) => string;
  emailLabel: (first: string) => string;
}> = {
  artists: {
    back: { href: "/#artists", label: "← Artists" },
    empty: "Artworks coming soon.",
    emailSubject: (name) => `${name} Art on IFAC`,
    emailLabel: (first) => `Email ${first} for pricing`,
  },
  dealers: {
    back: { href: "/#dealers", label: "← Art Dealers" },
    empty: "Featured works coming soon.",
    emailSubject: (name) => `IFAC inquiry — ${name}`,
    emailLabel: (first) => `Contact ${first}`,
  },
};

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;
const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

/**
 * The published-panel config, built once at module scope — same posture as
 * every other app's `serverPuckConfig`. `KNOWN_TYPES` is not needed here the
 * way a page route needs it: a missing panel already falls back to the plain
 * StoreShowcase, so a broken one reads as "no panel" rather than a 404.
 */
const storePanelConfig = buildPuckConfig({
  blocks: STORE_PANEL_BLOCKS,
  resolvers: storePanelServerResolvers(),
});

function kindMatches(kind: PersonKind, tags: string[]): boolean {
  return tags.includes("dealer") === (kind === "dealers");
}

async function viewerIdFromSession(): Promise<string | null> {
  const session = await getServerSession();
  return session.user ? (session.user.db_user_id ?? session.user.id) : null;
}

/** Title for generateMetadata; null when the page would 404 for a visitor. */
export async function personPageTitle(kind: PersonKind, slug: string): Promise<string | null> {
  // One query: getDirectoryProfile is undefined for a non-public row.
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== (kind === "dealers" ? "dealer" : "artist")) return null;
  return `${profile.name} — ${kind === "dealers" ? "IFAC Art Dealer" : "IFAC Artist"}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function threadItems(threads: PersonThread[], dateOf: (t: PersonThread) => string | null): PersonListItem[] {
  return threads.map((t) => {
    const foreign = t.orgId !== siteConfig.orgId;
    return {
      href: personThreadHref(t, {
        networkUrl: NETWORK_URL,
        localOrgId: siteConfig.orgId,
        localHref: threadHref,
      }),
      title: t.title,
      meta: [formatDate(dateOf(t)), t.location, foreign ? `on ${t.orgName}` : null].filter(Boolean).join(" · ") || null,
      excerpt: t.excerpt,
      external: foreign,
      draft: t.status !== "published",
    };
  });
}

export async function PersonView({
  kind,
  slug,
  startEditing,
}: {
  kind: PersonKind;
  slug: string;
  startEditing: boolean;
}) {
  const viewerId = await viewerIdFromSession();
  const page = await getPersonPage(slug, {
    orgId: siteConfig.orgId,
    viewerId,
    // `tags` can only require a tag; artists are "no dealer tag", checked below.
    ...(kind === "dealers" ? { tags: ["dealer"] } : {}),
    // WritingSection shows four and uses a fifth to decide on "more".
    writingLimit: 5,
  });
  // getPersonPage lets an editor see a non-public profile; IFAC does not.
  if (!page?.orgProfile || !page.orgProfile.isPublic || !kindMatches(kind, page.orgProfile.tags)) notFound();

  const profile = toIFACProfile(page.orgProfile);
  const userId = page.profile.userId;
  const { canEdit: editable, isSelf, show } = page;
  const copy = COPY[kind];

  const themeOverrides = editable ? await getThemeOverrides({ userId }) : {};

  // The store: a designed panel (published user_pages document "store:1")
  // takes over from the plain listing when one exists, so the same work is
  // not shown twice. Artists only, as before; store:2 and later are not
  // rendered because nothing switches them on or off yet.
  const storeShowcase = show.store
    ? await getStoreShowcaseForUser(userId, { limit: 6 }).catch(() => null)
    : null;
  const storePanel = show.store && kind === "artists"
    ? await loadPublishedUserPage(userId, siteConfig.orgId, "store:1").catch(() => null)
    : null;
  const storePanelResolved = storePanel
    ? await resolveAllData(storePanel.data as Data, storePanelConfig, {
        orgId: siteConfig.orgId,
        profileUserId: userId,
        viewerId: viewerId ?? undefined,
        canEdit: isSelf,
      }).catch((err) => {
        console.error(`[ifac] resolving store panel for ${slug}:`, err);
        return null;
      })
    : null;

  const galleryItems = profile.artworks.map((w, i) => ({
    id: w.id ?? `${slug}-${i}`,
    url: w.filename,
    title: w.title,
    x: w.x, y: w.y, w: w.w, h: w.h,
  }));

  const storeSlot = (
    <>
      {isSelf && kind === "artists" && (
        // The editor lives on art-auction: a store panel needs a store,
        // prices and product cards, which this app does not have. Without
        // this link /panel/ifac is reachable only by typing it.
        <p className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
          <a href={`/api/auth/handoff?${new URLSearchParams({ to: siteConfig.marketplaceUrl, next: "/panel/ifac" })}`} target="_blank" rel="noreferrer">
            {storePanelResolved ? "Edit your store →" : "Design a store panel →"}
          </a>
        </p>
      )}
      {storePanelResolved ? (
        // Bounded to the editor's own viewport (720px), so what the person
        // arranged there is what shows here.
        <div className="profile-store-panel mx-auto px-6 py-10" style={{ maxWidth: 720 }}>
          <Render config={storePanelConfig} data={storePanelResolved as Data} />
        </div>
      ) : storeShowcase ? (
        <div className="profile-store-panel mx-auto max-w-6xl px-6 py-10">
          <StoreShowcase
            store={storeShowcase.store}
            artworks={storeShowcase.artworks}
            marketplaceUrl={siteConfig.marketplaceUrl}
            from="ifac"
            handoff
            heading="Available work"
            columns={3}
          />
        </div>
      ) : null}
    </>
  );
  const hasStoreSlot = (isSelf && kind === "artists") || Boolean(storePanelResolved || storeShowcase);

  const slots: Record<string, ReactNode> = {
    galleries: show.galleries || editable ? (
      <GalleriesSection
        profileUserId={userId}
        profileSlug={profile.slug}
        kind={kind}
        galleries={page.galleries}
        editable={editable}
      />
    ) : null,
    blog: show.blog ? (
      <WritingSection
        profileUserId={userId}
        profileSlug={profile.slug}
        kind={kind}
        editable={editable}
        items={page.writing}
      />
    ) : null,
    posts: show.posts ? (
      <PersonThreadList
        title="Posts"
        items={threadItems(page.posts, (t) => t.publishedAt)}
        empty={isSelf ? "Nothing posted on IFAC yet." : null}
      />
    ) : null,
    events: show.events ? (
      <PersonThreadList
        title="Events"
        items={threadItems(page.events, (t) => t.scheduledAt ?? t.publishedAt)}
        empty={isSelf ? "No events on IFAC yet." : null}
      />
    ) : null,
    store: hasStoreSlot ? storeSlot : null,
  };

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="site-shell">
      {/* Site palette, then this person's own. Rendered for every visitor:
          an artist's chosen colours are part of their page. */}
      <ThemeStyle orgId={siteConfig.orgId} userId={userId} />
      <SiteHeader />
      <main>
        <PersonPage
          className="eac-person-page--frame"
          person={{
            displayName: profile.name,
            role: profile.role || null,
            bio: page.profile.bio,
            avatarUrl: profile.portrait || null,
            socialLinks: profile.links.map((l) => ({ label: l.label, url: l.href })),
          }}
          back={copy.back}
          intro={<ClaimPrompt slug={profile.slug} claimStatus={profile.claimStatus} />}
          editor={
            editable ? (
              <ProfileEditorPanel
                profileUserId={userId}
                slug={profile.slug}
                bio={profile.bio.join("\n\n")}
                avatarUrl={profile.portrait}
                themeOverrides={themeOverrides}
                isSelf={isSelf}
                startEditing={startEditing}
              />
            ) : null
          }
          sidebarExtra={
            profile.email ? (
              <a
                className="profile-email"
                href={`mailto:${profile.email}?subject=${encodeURIComponent(copy.emailSubject(profile.name))}`}
              >
                {copy.emailLabel(firstName)}
              </a>
            ) : null
          }
          featured={
            // data-theme-vars puts the ThemeStudio's frame pin on this panel.
            <div data-theme-vars={FRAME_THEME_VARS} data-theme-label="Featured work">
              {(galleryItems.length > 0 && show.portfolio) || editable ? (
                <GalleryPanel profileUserId={userId} slug={profile.slug} items={galleryItems} editable={editable} />
              ) : (
                <p className="profile-no-work">{copy.empty}</p>
              )}
            </div>
          }
          order={page.sections.map((s) => s.key)}
          slots={slots}
          networkLink={ARTDIRECT_URL && page.profile.slug ? { href: `${ARTDIRECT_URL}/${page.profile.slug}` } : null}
          after={page.profile.profileSections.elkdonisFeed ? <ElkdonisFeed /> : null}
        />
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

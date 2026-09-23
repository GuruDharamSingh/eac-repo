import { notFound } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { canEditProfile } from "@elkdonis/services";
import { getDirectoryProfile, listDirectorySlugs } from "@/lib/directory";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ClaimPrompt } from "@/components/claim-prompt";
import { ProfileEditorPanel } from "@/components/profile-editor-panel";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getThemeOverrides } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { GalleryPanel } from "@/components/gallery-panel";
import { GalleriesSection } from "@/components/galleries-section";
import { FRAME_THEME_VARS } from "@/lib/theme-tokens";
import { listUserGalleries } from "@elkdonis/services";
import { defaultSiteContent } from "@/lib/default-content";
import { ElkdonisFeed } from "@/components/elkdonis-feed";
import { WritingSection } from "@/components/writing-section";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getStoreShowcaseForUser, hasProfileSection } from "@elkdonis/commerce/queries";
import type { Metadata } from "next";
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

export const dynamic = "force-dynamic";

/**
 * The published-panel config, built once at module scope — same posture as
 * every other app's `serverPuckConfig`. `KNOWN_TYPES` is not needed here the
 * way a page route needs it: a MISSING panel already falls back to the plain
 * StoreShowcase (see below), so a broken one reads as "no panel" rather than
 * needing its own 404.
 */
const storePanelConfig = buildPuckConfig({
  blocks: STORE_PANEL_BLOCKS,
  resolvers: storePanelServerResolvers(),
});

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateStaticParams() {
  const slugs = await listDirectorySlugs("artist");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "artist") return {};
  return { title: `${profile.name} — IFAC Artist` };
}

export default async function ArtistPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "artist") notFound();

  // Owner (or global admin) gets the inline editor — everyone else gets the
  // same page, read-only. profile.userId is absent on the bundled static
  // fallback (no account behind it), so editing is never offered there.
  const session = await getServerSession();
  const viewerId = session.user ? (session.user.db_user_id ?? session.user.id) : null;
  const editable = Boolean(profile.userId && viewerId && (await canEditProfile(viewerId, profile.userId)));
  // canEditProfile is true for admins too; the palette is only the person's own.
  const isSelf = Boolean(profile.userId && viewerId && profile.userId === viewerId);
  const themeOverrides = profile.userId
    ? await getThemeOverrides({ userId: profile.userId })
    : {};

  // Sections this person switched on for their own page, from the hub.
  const showElkdonisFeed = profile.userId
    ? await hasProfileSection(profile.userId, "elkdonisFeed")
    : false;
  // Their own writing — the shelf and the reading room behind it. Off unless
  // they asked for it: a person who does not write should not carry an empty
  // section on their page.
  const showWriting = profile.userId
    ? await hasProfileSection(profile.userId, "blog")
    : false;
  // Their marketplace store, when they have switched the section on — a
  // window onto art-auction, not a checkout of IFAC's own.
  //
  // A DESIGNED panel (a published user_pages document, key "store:1") takes
  // over from the plain listing when one exists: it is what the person built
  // for themselves specifically, and a plain grid drawn underneath it too
  // would be showing the same work twice. No document, or nothing published
  // yet, and the plain listing is what shows — same as it always has.
  const storeShowcase =
    profile.userId && (await hasProfileSection(profile.userId, "store"))
      ? await getStoreShowcaseForUser(profile.userId, { limit: 6 }).catch(() => null)
      : null;
  const storePanel = profile.userId
    ? await loadPublishedUserPage(profile.userId, siteConfig.orgId, "store:1").catch(() => null)
    : null;
  const resolvePanel = (data: unknown) =>
    resolveAllData(data as Data, storePanelConfig, {
      orgId: siteConfig.orgId,
      profileUserId: profile.userId,
      viewerId: viewerId ?? undefined,
      canEdit: isSelf,
    }).catch((err) => {
      console.error(`[ifac] resolving store panel for ${slug}:`, err);
      return null;
    });
  const storePanelResolved = storePanel ? await resolvePanel(storePanel.data) : null;

  // Deliberately store:1 ONLY. A second page (store:2, store:3…) can exist
  // and be published — the editor's own Pages tab lets someone make one —
  // but nothing shows it here yet, on purpose: every OTHER thing on this
  // page that can be shown or hidden (writing, the Elkdonis feed, a
  // gallery) has a real switch behind it (profile_sections, is_public,
  // hidden_on). An extra panel page has none of that — no per-page setting
  // to turn it on or off, and it does not behave like the galleries
  // GalleriesSection already shows, which was exactly the confusion the
  // first version of this caused. Auto-showing every published page was the
  // wrong default until that control exists; render it deliberately, when
  // there is a way to choose to, not automatically because it happens to be
  // published.

  // Their gallery pages. Hidden ones are listed only for the owner/admin.
  const galleries = profile.userId
    ? await listUserGalleries(profile.userId, { onlyPublic: !editable, site: "ifac" })
    : [];

  const galleryItems = profile.artworks.map((w, i) => ({
    id: w.id ?? `${slug}-${i}`,
    url: w.filename,
    title: w.title,
    x: w.x, y: w.y, w: w.w, h: w.h,
  }));

  return (
    <div className="site-shell">
      {/* Site palette, then this person's own. Rendered for every visitor, not
          just the owner — an artist's chosen colours are part of their page,
          the same as their portrait. */}
      <ThemeStyle orgId={siteConfig.orgId} userId={profile.userId ?? null} />
      <SiteHeader />
      <main>
        <div className="profile-intro">
          <a className="profile-back" href="/#artists">← Artists</a>
          <h1 className="profile-name">{profile.name}</h1>
          <p className="profile-role">{profile.role}</p>
          <ClaimPrompt slug={profile.slug} claimStatus={profile.claimStatus} />
        </div>

        {editable && profile.userId && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
            <ProfileEditorPanel profileUserId={profile.userId} slug={profile.slug} bio={profile.bio.join("\n\n")} avatarUrl={profile.portrait} themeOverrides={themeOverrides} isSelf={isSelf} startEditing={edit === "1"} />
          </div>
        )}

        <div className="profile-body">
          <aside className="profile-sidebar" data-theme-vars={FRAME_THEME_VARS} data-theme-label="Sidebar">
            {profile.portrait && (
              <img src={profile.portrait} alt={profile.name} className="profile-portrait" />
            )}
            <div className="profile-bio" data-trait="bio">
              {profile.bio.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {profile.email && (
              <a className="profile-email" href={`mailto:${profile.email}?subject=${encodeURIComponent(profile.name + " Art on IFAC")}`}>
                Email {profile.name.split(" ")[0]} for pricing
              </a>
            )}
            {profile.links.length > 0 && (
              <ul className="profile-links">
                {profile.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="profile-gallery" data-theme-vars={FRAME_THEME_VARS} data-theme-label="Featured work">
            {galleryItems.length > 0 || editable ? (
              <GalleryPanel profileUserId={profile.userId ?? ""} slug={profile.slug} items={galleryItems} editable={editable} />
            ) : (
              <p className="profile-no-work">Artworks coming soon.</p>
            )}
          </section>
        </div>

        {profile.userId && (
          <GalleriesSection
            profileUserId={profile.userId}
            profileSlug={profile.slug}
            kind="artists"
            galleries={galleries}
            editable={editable}
          />
        )}

        {showWriting && profile.userId && (
          <WritingSection
            profileUserId={profile.userId}
            profileSlug={profile.slug}
            kind="artists"
            editable={editable}
          />
        )}

        {isSelf && (
          // The editor lives on art-auction, not here — a store panel is a
          // marketplace concept (it needs a store, prices, product cards),
          // and this app has none of that machinery. Without this link the
          // only way to find /panel/ifac is to already know the URL.
          <p className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
            <a href={`${siteConfig.marketplaceUrl}/panel/ifac`} target="_blank" rel="noreferrer">
              {storePanelResolved ? "Edit your store →" : "Design a store panel →"}
            </a>
          </p>
        )}
        {storePanelResolved ? (
          // Their own designed panel — a bounded section, not the whole
          // page: the width matches the editor's own viewport (720px), so
          // what they arranged there is what shows here. store:1 only —
          // see the note above.
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
              heading="Available work"
              columns={3}
            />
          </div>
        ) : null}
        {showElkdonisFeed && <ElkdonisFeed />}
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

/**
 * Whether this person opted into an optional page section.
 *
 * Fail-soft to false: a page that renders without an extra section is fine, a
 * page that 500s because of one is not.
 */


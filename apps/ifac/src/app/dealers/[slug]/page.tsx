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
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
import { db } from "@elkdonis/db";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateStaticParams() {
  const slugs = await listDirectorySlugs("dealer");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "dealer") return {};
  return { title: `${profile.name} — IFAC Art Dealer` };
}

export default async function DealerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "dealer") notFound();

  // Owner (or global admin) gets the inline editor — everyone else gets the
  // same page, read-only. Mirrors apps/ifac/src/app/artists/[slug]/page.tsx.
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
  // Their marketplace store, when they have switched the section on — a
  // window onto art-auction, not a checkout of IFAC's own.
  const storeShowcase =
    profile.userId && (await hasProfileSection(profile.userId, "store"))
      ? await getStoreShowcaseForUser(profile.userId, { limit: 6 }).catch(() => null)
      : null;

  // Their gallery pages. Hidden ones are listed only for the owner/admin.
  const galleries = profile.userId
    ? await listUserGalleries(profile.userId, { onlyPublic: !editable })
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
          <a className="profile-back" href="/#dealers">← Art Dealers</a>
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
              <a className="profile-email" href={`mailto:${profile.email}?subject=${encodeURIComponent("IFAC inquiry — " + profile.name)}`}>
                Contact {profile.name.split(" ")[0]}
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
              <p className="profile-no-work">Featured works coming soon.</p>
            )}
          </section>
        </div>

        {profile.userId && (
          <GalleriesSection
            profileUserId={profile.userId}
            profileSlug={profile.slug}
            kind="dealers"
            galleries={galleries}
            editable={editable}
          />
        )}

        {storeShowcase && (
          <div className="mx-auto max-w-6xl px-6 py-10">
            <StoreShowcase
              store={storeShowcase.store}
              artworks={storeShowcase.artworks}
              marketplaceUrl={siteConfig.marketplaceUrl}
              heading="Available work"
              columns={3}
            />
          </div>
        )}
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
async function hasProfileSection(userId: string, key: string): Promise<boolean> {
  try {
    const [row] = await db<Array<{ on: boolean }>>`
      SELECT COALESCE((profile_sections->>${key})::boolean, false) AS on
      FROM users WHERE id = ${userId}
    `;
    return Boolean(row?.on);
  } catch (error) {
    console.error("[ifac] hasProfileSection error:", error);
    return false;
  }
}

import { notFound } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { canEditProfile, getUserGallery, renderThemeCss } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getDirectoryProfile } from "@/lib/directory";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { GalleryEditor } from "@/components/gallery-editor";
import { defaultSiteContent } from "@/lib/default-content";
import { siteConfig } from "@/config/site";

/**
 * One gallery page behind an artist or dealer: /<kind>/<slug>/galleries/<gallery>.
 *
 * Shared by both routes so the two stay identical; only the back link and
 * the kind check differ. The gallery is looked up under the PROFILE's user
 * id, so a gallery slug can only ever resolve to that person's own page —
 * two artists may both have a "2024" gallery.
 *
 * A hidden gallery 404s for everyone but its owner and admins: there is no
 * "private page" state to leak, it simply does not exist for others.
 */
export async function GalleryPageView({
  kind,
  slug,
  gallerySlug,
  startEditing,
}: {
  kind: "artist" | "dealer";
  slug: string;
  gallerySlug: string;
  startEditing: boolean;
}) {
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== kind || !profile.userId) notFound();

  const session = await getServerSession();
  const viewerId = session.user ? (session.user.db_user_id ?? session.user.id) : null;
  const editable = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));

  const gallery = await getUserGallery(profile.userId, gallerySlug);
  if (!gallery || (!gallery.isPublic && !editable)) notFound();

  const base = kind === "artist" ? "artists" : "dealers";
  const profileHref = `/${base}/${profile.slug}`;
  // This page's own overrides, after the site's and the person's, so the
  // gallery can be framed differently from the profile it hangs off.
  const pageCss = renderThemeCss(gallery.settings);

  return (
    <div className="site-shell gallery-page">
      <ThemeStyle orgId={siteConfig.orgId} userId={profile.userId} />
      {pageCss && <style id="eac-gallery-theme" dangerouslySetInnerHTML={{ __html: pageCss }} />}
      <SiteHeader />
      <main>
        <div className="gallery-page-head">
          <a className="profile-back" href={profileHref}>← {profile.name}</a>
          <p className="gallery-page-artist">{kind === "artist" ? "A gallery by" : "A selection from"} {profile.name}</p>
          <h1 className="gallery-page-title" data-trait="galleryTitle">{gallery.title}</h1>
          <p className="gallery-page-description" data-trait="galleryDescription">{gallery.description ?? ""}</p>
        </div>

        <GalleryEditor
          galleryId={gallery.id}
          title={gallery.title}
          description={gallery.description ?? ""}
          isPublic={gallery.isPublic}
          settings={gallery.settings}
          items={gallery.items.map((w, i) => ({
            id: w.id ?? `${gallery.id}-${i}`,
            url: w.url,
            title: w.title,
            x: w.x, y: w.y, w: w.w, h: w.h,
          }))}
          memberSlug={profile.slug}
          profileHref={profileHref}
          editable={editable}
          startEditing={editable && startEditing}
        />
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

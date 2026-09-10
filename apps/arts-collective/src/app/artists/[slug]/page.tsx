import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfileBySlug } from "@elkdonis/services";
import { ProfileView } from "@elkdonis/cms-ui/profile";
import { SiteShell } from "@/components/site-shell";

/**
 * A person's profile on arts-collective.
 *
 * Renders the same ProfileView that ArtDirect uses, so a person's page looks
 * and reads the same wherever it appears — which is the point of moving it
 * into @elkdonis/cms-ui rather than leaving it in apps/artdirect. When the
 * directory is folded into this app, this route is already the destination.
 *
 * Read-only for now: the inline editor and the drag-to-arrange gallery are
 * bound to server actions that only exist in ArtDirect, and ProfileView takes
 * them as slots precisely so an app can render the page without them. The
 * portfolio still shows, as a plain server-rendered grid.
 *
 * Note this sits under /artists, whose index lists ORGS (each artist's own
 * site). This is the person behind that, addressed by users.slug — the same
 * slug that names their Nextcloud folder.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return {};
  return {
    title: `${profile.displayName} — Elkdonis Arts Collective`,
    description: profile.headline ?? profile.bio?.slice(0, 160) ?? undefined,
  };
}

export default async function ArtistProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);

  // Unlisted people still have a slug and a folder — they simply aren't in
  // the public directory. Rendering them here would route around that, so a
  // profile is only public on this site if its owner has chosen to be listed.
  if (!profile || !profile.directoryListed) notFound();

  const works = profile.portfolio.filter((w) => w.url);

  return (
    <SiteShell>
      <ProfileView
        person={{
          displayName: profile.displayName,
          headline: profile.headline,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          pronouns: profile.pronouns,
          city: profile.city,
          verified: profile.verified,
          portfolioUrl: profile.portfolioUrl,
          socialLinks: profile.socialLinks,
        }}
        gallery={
          works.length > 0 ? (
            <div className="eac-profile-grid">
              {works.map((w, i) => (
                <figure key={w.id ?? `${slug}-${i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.url} alt={w.title ?? ""} loading="lazy" />
                  {w.title && <figcaption>{w.title}</figcaption>}
                </figure>
              ))}
            </div>
          ) : undefined
        }
      />
    </SiteShell>
  );
}

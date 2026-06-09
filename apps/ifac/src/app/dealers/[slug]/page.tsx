import { notFound } from "next/navigation";
import { getDirectoryProfile, listDirectorySlugs } from "@/lib/directory";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { defaultSiteContent } from "@/lib/default-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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

export default async function DealerPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "dealer") notFound();

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <div className="profile-intro">
          <a className="profile-back" href="/#dealers">← Art Dealers</a>
          <h1 className="profile-name">{profile.name}</h1>
          <p className="profile-role">{profile.role}</p>
        </div>

        <div className="profile-body">
          <aside className="profile-sidebar">
            {profile.portrait && (
              <img src={profile.portrait} alt={profile.name} className="profile-portrait" />
            )}
            <div className="profile-bio">
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

          <section className="profile-gallery">
            {profile.artworks.length > 0 ? (
              <div className="artwork-grid">
                {profile.artworks.map((work) => (
                  <figure className="artwork-card" key={work.filename}>
                    <img src={work.filename} alt={work.title} loading="lazy" />
                    <figcaption>{work.title}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="profile-no-work">Featured works coming soon.</p>
            )}
          </section>
        </div>
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

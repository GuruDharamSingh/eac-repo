import { getServerSession } from "@elkdonis/auth-server";
import { getSiteContent } from "@/lib/data";
import { listDirectory } from "@/lib/directory";
import { fetchBlogPosts } from "@/lib/blog-feed";
import { socialIcon } from "@/lib/social-icons";
import { AuthPanel } from "@/components/auth-panel";
import { BlogCardGrid } from "@/components/blog-card";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { GalleryItem, SiteLink } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, directoryArtists, directoryDealers] = await Promise.all([
    getSiteContent(),
    listDirectory("artist"),
    listDirectory("dealer"),
  ]);

  // Only to decide whether the panel offers a form or a way through to the
  // hub — nothing on this page is gated on it.
  const session = await getServerSession();

  // Needs content.blog.href, so it cannot join the Promise.all above.
  // Returns [] on any failure, which is what selects the iframe fallback.
  const blogPosts = await fetchBlogPosts(content.blog.href, 6);

  // Special non-roster campaign tiles (e.g. "Vote For Andre") still come from
  // the editable gallery section.
  const campaignItems = content.gallery.items.filter((item) => item.id === "andre-pace-vote");

  return (
    <div className="site-shell">
      <SiteHeader
        banner={{ imageUrl: content.hero.imageUrl, alt: "IFAC home page banner" }}
      />
      <main className="ifac-directory">
        <section id="about" className="ifac-panel intro-panel">
          <h1>{content.about.kicker}</h1>
          <p>{content.about.body}</p>
        </section>

        <section id="artists" className="ifac-panel">
          <h2>{content.gallery.title}</h2>
          <div className="directory-links artist-links">
            {directoryArtists.map((artist) => (
              <DirectoryLink
                key={artist.slug}
                link={{ label: artist.name, href: `/artists/${artist.slug}` }}
                avatar={artist.portrait}
              />
            ))}
            {campaignItems.map((item) => <ArtistLink key={item.id} item={item} />)}
          </div>
        </section>

        <section id="dealers" className="ifac-panel">
          <h2>{content.dealers.title}</h2>
          <div className="directory-links">
            {directoryDealers.map((dealer) => (
              <DirectoryLink
                key={dealer.slug}
                link={{ label: dealer.name, href: `/dealers/${dealer.slug}` }}
                avatar={dealer.portrait}
              />
            ))}
          </div>
        </section>

        <section id="blog" className="ifac-panel media-panel">
          <h2><a href={content.blog.href} target="_blank" rel="noreferrer">{content.blog.title}</a></h2>
          {blogPosts.length > 0 ? (
            <>
              <BlogCardGrid posts={blogPosts} />
              <p className="blog-feed-more">
                <a href={content.blog.href} target="_blank" rel="noreferrer">
                  Read the full blog →
                </a>
              </p>
            </>
          ) : (
            <div className="embed-frame blog-frame">
              <iframe src={content.blog.embedUrl} title="IFAC Blog" loading="lazy" />
            </div>
          )}
        </section>

        <section id="videos" className="ifac-panel media-panel">
          <h2><a href={content.videos.playlistUrl} target="_blank" rel="noreferrer">{content.videos.title}</a></h2>
          <div className="video-grid">
            {content.videos.embeds.map((video) => (
              <div className="embed-frame video-frame" key={video.src}>
                <iframe src={video.src} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
              </div>
            ))}
          </div>
          <a className="more-videos" href={content.videos.playlistUrl} target="_blank" rel="noreferrer">
            More IFAC videos &rarr;
          </a>
        </section>

        <section id="social" className="ifac-panel">
          <h2>{content.social.title}</h2>
          {/* The socialshort.png strip that used to sit here was a picture of
              these same platforms; with a real icon per link it was saying the
              same thing twice, and it was not clickable. */}
          <div className="social-row">
            <span className="social-row-label">Social:</span>
            <ul className="social-row-links">
              {content.social.links.map((link) => {
                const icon = socialIcon(link.href);
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                      /* Icon-only, so the label has to survive as the
                         accessible name — otherwise every one of these reads
                         as "link" to a screen reader, and the tooltip gives
                         sighted users the same text on hover. */
                      aria-label={link.label}
                      title={link.label}
                    >
                      {icon ? (
                        <span
                          className="social-icon"
                          style={{ ["--social-icon" as string]: `url(/social/${icon}.svg)` }}
                          aria-hidden
                        />
                      ) : (
                        /* An unrecognised host has no mark to show, so fall
                           back to the label rather than an empty hit area. */
                        <span className="social-row-fallback">{link.label}</span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="signup" className="ifac-panel live-panel">
          <h2>{content.signup.title}</h2>
          <p>{content.signup.body}</p>
          <AuthPanel signedInEmail={session.user?.email ?? null} />
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}

function ArtistLink({ item }: { item: GalleryItem }) {
  const href = item.linkUrl || "/gallery";
  if (item.id === "andre-pace-vote") {
    return (
      <a className="image-link" href={href} target="_blank" rel="noreferrer" aria-label="Vote For Andre">
        <img src={item.imageUrl} alt={item.title} />
      </a>
    );
  }

  return <DirectoryLink link={{ label: item.title, href }} />;
}


function DirectoryLink({
  link,
  avatar,
  icon,
}: {
  link: SiteLink;
  /** Portrait for a person. Omitted by the social and campaign links, which
   *  are not people — they keep rendering as a plain label. */
  avatar?: string | null;
  /** Name of a mark in /public/social. Drawn as a CSS mask rather than an
   *  <img> so it takes the link's own colour — Simple Icons bakes in brand
   *  colours, and X's is pure black, which is invisible on this panel. */
  icon?: string | null;
}) {
  const external = link.href.startsWith("http");
  return (
    <a
      href={link.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {icon && (
        <span
          className="social-icon"
          style={{ ["--social-icon" as string]: `url(/social/${icon}.svg)` }}
          aria-hidden
        />
      )}
      {avatar !== undefined && (
        avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="directory-avatar" src={avatar} alt="" loading="lazy" />
        ) : (
          // Every current IFAC profile has a portrait, but a new one may not,
          // and a missing image would collapse the row and misalign the name
          // against its neighbours. The initial keeps the grid regular.
          <span className="directory-avatar directory-avatar--empty" aria-hidden>
            {link.label.trim().charAt(0).toUpperCase()}
          </span>
        )
      )}
      <span className="directory-name">{link.label}</span>
    </a>
  );
}

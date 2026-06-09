import { getSiteContent, getUpcomingEvents, formatEventDate } from "@/lib/data";
import { listDirectory } from "@/lib/directory";
import { SignupForm } from "@/components/signup-form";
import { RsvpForm } from "@/components/rsvp-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { GalleryItem, SiteLink } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, events, directoryArtists, directoryDealers] = await Promise.all([
    getSiteContent(),
    getUpcomingEvents(),
    listDirectory("artist"),
    listDirectory("dealer"),
  ]);

  // Special non-roster campaign tiles (e.g. "Vote For Andre") still come from
  // the editable gallery section.
  const campaignItems = content.gallery.items.filter((item) => item.id === "andre-pace-vote");

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="ifac-directory">
        <section className="hero image-only" aria-label="IFAC banner">
          <img src={content.hero.imageUrl} alt="IFAC home page banner" />
        </section>

        <section id="about" className="ifac-panel intro-panel">
          <h1>{content.about.kicker}</h1>
          <p>{content.about.body}</p>
        </section>

        <section id="artists" className="ifac-panel">
          <h2>{content.gallery.title}</h2>
          <div className="directory-links artist-links">
            {directoryArtists.map((artist) => (
              <DirectoryLink key={artist.slug} link={{ label: artist.name, href: `/artists/${artist.slug}` }} />
            ))}
            {campaignItems.map((item) => <ArtistLink key={item.id} item={item} />)}
          </div>
        </section>

        <section id="dealers" className="ifac-panel">
          <h2>{content.dealers.title}</h2>
          <div className="directory-links">
            {directoryDealers.map((dealer) => (
              <DirectoryLink key={dealer.slug} link={{ label: dealer.name, href: `/dealers/${dealer.slug}` }} />
            ))}
          </div>
        </section>

        <section id="blog" className="ifac-panel media-panel">
          <h2><a href={content.blog.href} target="_blank" rel="noreferrer">{content.blog.title}</a></h2>
          <div className="embed-frame blog-frame">
            <iframe src={content.blog.embedUrl} title="IFAC Blog" loading="lazy" />
          </div>
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
            <img src="https://ifacgroup.com/images/morevideos1.png" alt="More IFAC videos" />
          </a>
        </section>

        <section id="social" className="ifac-panel">
          <h2>{content.social.title}</h2>
          <img className="social-icons-strip" src={content.social.iconUrl} alt="IFAC social media" />
          <div className="directory-links social-links">
            {content.social.links.map((link) => <DirectoryLink key={link.href} link={link} />)}
          </div>
        </section>

        <section id="events" className="ifac-panel live-panel">
          <h2>{content.rsvp.title}</h2>
          <p>{content.rsvp.body}</p>
          <RsvpForm events={events} />
          <div className="event-list">
            {events.map((event) => (
              <article className="event-card" key={event.id}>
                <strong>{event.title}</strong>
                <span>{formatEventDate(event.scheduled_at)}</span>
                <span>{event.location || "Location TBA"} / {event.rsvp_count} RSVP</span>
              </article>
            ))}
          </div>
        </section>

        <section id="signup" className="ifac-panel live-panel">
          <h2>{content.signup.title}</h2>
          <p>{content.signup.body}</p>
          <SignupForm />
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

function DirectoryLink({ link }: { link: SiteLink }) {
  return (
    <a href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined}>
      {link.label}
    </a>
  );
}

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/data";

export const metadata = { title: "Gallery | IFAC" };
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const content = await getSiteContent();
  const mediums = Array.from(new Set(content.gallery.items.map((item) => item.medium)));

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <div className="page-heading">
          <p className="kicker">Gallery</p>
          <h1>{content.gallery.title}</h1>
          <p className="body-copy">{content.gallery.intro}</p>
        </div>

        <section className="section" data-tone="light">
          <div className="section-inner">
            <div className="stats-grid" style={{ marginTop: 0 }}>
              <div className="stat-tile">{content.gallery.items.length} listed works and artist profiles</div>
              <div className="stat-tile">{mediums.join(", ")}</div>
              <div className="stat-tile">Artist, collector and dealer discovery</div>
            </div>
            <div className="gallery-grid" style={{ marginTop: "2rem" }}>
              {content.gallery.items.map((item) => (
                <article className="gallery-card" key={item.id}>
                  <img src={item.imageUrl} alt={`${item.artist} gallery preview`} />
                  <div className="gallery-body">
                    <p className="kicker">{item.status || "IFAC gallery"}</p>
                    <h3>{item.title}</h3>
                    <p className="gallery-meta">Artist: {item.artist}</p>
                    <p className="gallery-meta">Medium: {item.medium}</p>
                    <p className="gallery-meta">Region: {item.region}</p>
                    {item.linkUrl ? <p><a className="button" href={item.linkUrl}>Open profile</a></p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter content={content.footer} />
    </div>
  );
}

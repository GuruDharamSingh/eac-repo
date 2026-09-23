import { listUserGalleries } from '@elkdonis/services';
import { getSiteOwnerUserId, getViewer } from '@/lib/auth';
import { GalleriesPanel } from '@/components/hud/galleries-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Galleries' };

/**
 * The Galleries index — what her nav calls "Partial Gallery", grown up.
 *
 * Every gallery is a row in user_galleries (hers — this is her personal site).
 * Most are COLLECTIONS with a page of their own (Figurative → /figurative), and
 * a card goes to that page, which is the gallery's public face. A gallery with
 * no page opens at /gallery/<slug>.
 *
 * Visitors see the galleries she has listed (is_public). Editors also get the
 * gallery manager — the same one as the editor's left rail and /hub.
 */
export default async function GalleryIndexPage() {
  const [viewer, ownerUserId] = await Promise.all([getViewer(), getSiteOwnerUserId()]);
  const isEditor = Boolean(viewer?.canEdit);

  const galleries = ownerUserId ? await listUserGalleries(ownerUserId, { onlyPublic: true }) : [];

  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Galleries</h1>

      {galleries.length === 0 ? (
        <p>{isEditor ? 'No gallery is listed in the index yet — tick “Listed in the Galleries index” on one below.' : 'No galleries yet.'}</p>
      ) : (
        <div className="gallery-cards">
          {galleries.map((g) => (
            <a key={g.id} className="gallery-card" href={g.pagePath ? `/${g.pagePath}` : `/gallery/${g.slug}`}>
              {g.coverUrl ? (
                <img
                  className="gallery-card-cover"
                  src={g.coverUrl.startsWith('/api/media/') ? `${g.coverUrl}?w=512` : g.coverUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="gallery-card-cover gallery-card-cover--blank">No images yet</div>
              )}
              <p className="gallery-card-title">{g.title}</p>
              <p className="gallery-card-meta">
                {g.itemCount ? `${g.itemCount} work${g.itemCount === 1 ? '' : 's'}` : 'Empty'}
              </p>
            </a>
          ))}
        </div>
      )}

      {isEditor ? (
        <section style={{ marginTop: '3rem', borderRadius: 8, overflow: 'hidden' }} aria-label="Manage galleries">
          <GalleriesPanel />
        </section>
      ) : null}
    </article>
  );
}

import { listUserGalleries } from '@elkdonis/services';
import { getSiteOwnerUserId, getViewer } from '@/lib/auth';
import { NewGalleryForm } from '@/components/new-gallery-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partial Gallery' };

/**
 * Her real nav calls this "Partial Gallery" — one page per series/show,
 * backed by user_galleries (124), the same table + @elkdonis/cms-ui/gallery
 * IFAC's artist pages consume.
 */
export default async function GalleryIndexPage() {
  const [viewer, ownerUserId] = await Promise.all([getViewer(), getSiteOwnerUserId()]);
  const isOwner = Boolean(viewer?.canEdit);

  const galleries = ownerUserId
    ? await listUserGalleries(ownerUserId, { onlyPublic: !isOwner })
    : [];

  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Partial Gallery</h1>

      {galleries.length === 0 && (
        <p>
          {ownerUserId
            ? 'No galleries yet.'
            : 'No gallery yet — the site owner has not been set up.'}
        </p>
      )}

      {galleries.length > 0 && (
        <div className="gallery-cards">
          {galleries.map((g) => (
            <a key={g.id} className="gallery-card" href={`/gallery/${g.slug}`}>
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="gallery-card-cover" src={g.coverUrl} alt="" loading="lazy" />
              ) : (
                <div className="gallery-card-cover gallery-card-cover--blank">No images yet</div>
              )}
              <p className="gallery-card-title">
                {g.title}
                {isOwner && !g.isPublic && <span style={{ marginLeft: 6 }}>(hidden)</span>}
              </p>
              <p className="gallery-card-meta">
                {g.itemCount ? `${g.itemCount} image${g.itemCount === 1 ? '' : 's'}` : 'Empty'}
              </p>
            </a>
          ))}
        </div>
      )}

      {isOwner && ownerUserId && <NewGalleryForm />}
    </article>
  );
}

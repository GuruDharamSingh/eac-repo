import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getUserGallery } from '@elkdonis/services';
import { getSiteOwnerUserId, getViewer } from '@/lib/auth';
import { loadGalleryWorks } from '@/lib/artworks';
import { ArtworkWall } from '@/blocks/artwork-wall';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ gallery: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gallery: gallerySlug } = await params;
  const ownerUserId = await getSiteOwnerUserId();
  if (!ownerUserId) return {};
  const gallery = await getUserGallery(ownerUserId, gallerySlug);
  if (!gallery || !gallery.isPublic) return {};
  return { title: gallery.title };
}

/**
 * One gallery with no page of its own. A gallery that HAS a page is shown
 * there (with whatever else that page holds), so this address forwards to it.
 */
export default async function GalleryDetailPage({ params }: Props) {
  const { gallery: gallerySlug } = await params;
  const ownerUserId = await getSiteOwnerUserId();
  if (!ownerUserId) notFound();

  const viewer = await getViewer();
  const editable = Boolean(viewer?.canEdit);

  const gallery = await getUserGallery(ownerUserId, gallerySlug);
  if (!gallery || (!gallery.isPublic && !editable)) notFound();
  if (gallery.pagePath) redirect(`/${gallery.pagePath}`);

  const items = await loadGalleryWorks({ galleryId: gallery.id, limit: 200 });

  return (
    <article className="content-page content-page--wide">
      <p style={{ marginBottom: '0.25rem' }}>
        <a href="/gallery">← Galleries</a>
        {editable ? (
          <>
            {' · '}
            <a href={`/hub?tab=galleries&gallery=${gallery.id}`}>Manage this gallery</a>
          </>
        ) : null}
      </p>
      <h1 className="page-title">{gallery.title}</h1>
      {gallery.description && <p>{gallery.description}</p>}
      <ArtworkWall
        heading=""
        source="gallery"
        layout="wall"
        limit={200}
        showPrice
        buyLabel="Enquire / buy"
        items={items}
      />
    </article>
  );
}

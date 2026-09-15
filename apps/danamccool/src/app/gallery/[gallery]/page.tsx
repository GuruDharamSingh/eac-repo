import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getUserGallery } from '@elkdonis/services';
import { getSiteOwnerUserId, getViewer } from '@/lib/auth';
import { GalleryPageView } from '@/components/gallery-page-view';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ gallery: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gallery: gallerySlug } = await params;
  const ownerUserId = await getSiteOwnerUserId();
  if (!ownerUserId) return {};
  const gallery = await getUserGallery(ownerUserId, gallerySlug);
  if (!gallery || !gallery.isPublic) return {};
  return { title: `${gallery.title} — Dana McCool` };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { gallery: gallerySlug } = await params;
  const ownerUserId = await getSiteOwnerUserId();
  if (!ownerUserId) notFound();

  const viewer = await getViewer();
  const editable = Boolean(viewer?.canEdit && viewer.userId === ownerUserId);

  const gallery = await getUserGallery(ownerUserId, gallerySlug);
  if (!gallery || (!gallery.isPublic && !editable)) notFound();

  return (
    <article className="content-page content-page--wide">
      <p style={{ marginBottom: '0.25rem' }}>
        <a href="/gallery">← Partial Gallery</a>
      </p>
      <h1 className="page-title">{gallery.title}</h1>
      {gallery.description && <p>{gallery.description}</p>}
      <GalleryPageView
        galleryId={gallery.id}
        items={gallery.items.map((w, i) => ({
          id: w.id ?? `${gallery.id}-${i}`,
          url: w.url,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
        }))}
        editable={editable}
      />
    </article>
  );
}

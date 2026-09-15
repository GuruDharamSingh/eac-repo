'use client';

import { ProfileGallery, type GalleryItem } from '@elkdonis/cms-ui/gallery';
import { saveGalleryItemsAction } from '@/lib/gallery-actions';

/**
 * Thin client wrapper around the shared ProfileGallery so the server page
 * can stay a server component. Persistence goes straight to the gallery's
 * own row via saveGalleryItemsAction — no debouncing beyond what
 * ProfileGallery already does internally on change.
 */
export function GalleryPageView({
  galleryId,
  items,
  editable,
}: {
  galleryId: string;
  items: GalleryItem[];
  editable: boolean;
}) {
  return (
    <ProfileGallery
      items={items}
      editable={editable}
      onChange={(next) => {
        void saveGalleryItemsAction(galleryId, next);
      }}
      uploadEndpoint="/api/media/upload"
    />
  );
}

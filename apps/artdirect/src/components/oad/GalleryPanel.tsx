"use client";

import { ProfileGallery, type GalleryItem } from "@elkdonis/ui";
import { saveGalleryAction } from "@/lib/profile-editor-actions";

/**
 * Thin client wrapper so the (server-component) /[slug] page can render the
 * shared ProfileGallery without itself needing to be a client component —
 * mirrors apps/ifac/src/components/gallery-panel.tsx, with the upload form
 * field renamed from IFAC's org-scoped `memberSlug` to plain `slug` (see
 * ArtDirect's own /api/upload route, which isn't org-scoped).
 */
export function GalleryPanel({
  profileUserId,
  slug,
  items,
  editable,
}: {
  profileUserId: string;
  slug: string;
  items: GalleryItem[];
  editable: boolean;
}) {
  return (
    <ProfileGallery
      items={items}
      editable={editable}
      uploadEndpoint="/api/upload"
      uploadExtraFields={{ slug }}
      onChange={editable ? (next) => { void saveGalleryAction(profileUserId, next); } : undefined}
    />
  );
}

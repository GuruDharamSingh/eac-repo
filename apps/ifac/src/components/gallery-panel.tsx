"use client";

import { ProfileGallery, type GalleryItem } from "@elkdonis/ui";
import { saveGalleryAction } from "@/lib/profile-editor-actions";

/**
 * Thin client wrapper so the (server-component) artist/dealer pages can
 * render the shared ProfileGallery without themselves needing to be client
 * components — this is the only place that binds the shared, app-agnostic
 * gallery to IFAC's own save action.
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
      uploadExtraFields={{ memberSlug: slug }}
      onChange={editable ? (next) => { void saveGalleryAction(profileUserId, next); } : undefined}
    />
  );
}

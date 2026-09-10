"use client";

import { useState } from "react";
// Imported straight from @elkdonis/live-editor, not re-exported through
// @elkdonis/ui: LiveEditor itself uses no Mantine, but the ui barrel
// declares Mantine as a dependency, so importing through it pulls Mantine
// into an app that is deliberately without it.
import { LiveEditor, type FieldDef } from "@elkdonis/live-editor";
import {
  saveProfileFieldAction,
  saveAvatarAction,
  setProfileSectionAction,
} from "@/lib/profile-editor-actions";

export interface ProfileEditorPanelProps {
  profileUserId: string;
  slug: string;
  bio: string;
  avatarUrl: string;
  /** Whether the person has an active marketplace store. */
  hasStore?: boolean;
  /** Whether their store section is currently shown on this page. */
  storeSectionOn?: boolean;
  marketplaceUrl?: string;
}

/**
 * The owner-only editing chrome for ArtDirect's own /[slug] page (standard
 * layout): the LiveEditor control bar (bio, pinned via the page's own
 * data-trait="bio" marker) and a "change portrait" upload control. Mirrors
 * apps/ifac/src/components/profile-editor-panel.tsx, scoped down to just
 * these two fields — no theme/CssPanel block, out of scope here.
 *
 * The gallery itself isn't in here — GalleryPanel/ProfileGallery renders for
 * every visitor (that's how the lightbox gets to non-owners too), just with
 * editable=false when the viewer isn't the owner. See StandardProfile.
 *
 * Only rendered at all when the viewer owns this profile or is an admin —
 * see StandardProfile's isSelf gate. The server actions re-check
 * authorization themselves regardless (see profile-editor-actions.ts).
 */
export function ProfileEditorPanel({
  profileUserId,
  slug,
  bio,
  avatarUrl,
  hasStore = false,
  storeSectionOn = false,
  marketplaceUrl = "",
}: ProfileEditorPanelProps) {
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [storeOn, setStoreOn] = useState(storeSectionOn);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const market = marketplaceUrl.replace(/\/$/, "");

  async function toggleStore(next: boolean) {
    setStoreOn(next);
    setStoreSaving(true);
    setStoreError(null);
    const res = await setProfileSectionAction(profileUserId, "store", next);
    setStoreSaving(false);
    if (!res.ok) {
      // Put the switch back: a toggle left flipped after a failed save says
      // something is on when it isn't.
      setStoreOn(!next);
      setStoreError(res.error ?? "Could not save that.");
      return;
    }
    window.location.reload();
  }

  const fields: FieldDef[] = [
    { trait: "bio", label: "Bio", input: "textarea", initialValue: bio, hint: "Blank lines separate paragraphs." },
  ];

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("slug", slug);
    formData.append("target", "avatar");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setUploadingAvatar(false);
    if (res.ok && data.url) {
      setAvatar(data.url);
      await saveAvatarAction(profileUserId, data.url);
    }
  }

  return (
    <div className="oad-editor">
      <LiveEditor
        fields={fields}
        role="Owner"
        onSaveField={(payload) => saveProfileFieldAction(profileUserId, payload)}
      />

      <label className="oad-editor-avatar">
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="oad-editor-avatar-preview" />
        )}
        <span className="oad-editor-btn">
          {uploadingAvatar ? "Uploading…" : "Change portrait"}
        </span>
        <input
          type="file"
          accept="image/*"
          disabled={uploadingAvatar}
          onChange={(e) => handleAvatarFile(e.currentTarget.files?.[0])}
          style={{ display: "none" }}
        />
      </label>

      {/* The store is a front for this profile; whether it shows here is the
          person's call (users.profile_sections.store — the same flag every
          org site reads). */}
      <div className="oad-editor-store mt-3 text-sm">
        {hasStore ? (
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={storeOn}
              disabled={storeSaving}
              onChange={(e) => void toggleStore(e.currentTarget.checked)}
              className="mt-1 accent-gold"
            />
            <span>
              Show my store on my profile
              {market && (
                <>
                  {" "}·{" "}
                  <a href={`${market}/studio`} className="text-gold underline underline-offset-4">
                    studio
                  </a>
                </>
              )}
              {storeError && <span className="block text-ink-soft">{storeError}</span>}
            </span>
          </label>
        ) : market ? (
          <a href={`${market}/studio/apply`} className="oad-editor-btn">
            Sell your work on the marketplace
          </a>
        ) : null}
      </div>
    </div>
  );
}

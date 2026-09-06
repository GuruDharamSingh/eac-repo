"use client";

import { useState } from "react";
import { LiveEditor, type FieldDef } from "@elkdonis/ui";
import { saveProfileFieldAction, saveAvatarAction } from "@/lib/profile-editor-actions";

export interface ProfileEditorPanelProps {
  profileUserId: string;
  slug: string;
  bio: string;
  avatarUrl: string;
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
export function ProfileEditorPanel({ profileUserId, slug, bio, avatarUrl }: ProfileEditorPanelProps) {
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    </div>
  );
}

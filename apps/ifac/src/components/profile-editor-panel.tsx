"use client";

import { useState } from "react";
import { LiveEditor, type FieldDef } from "@elkdonis/ui";
import { CssPanel } from "@elkdonis/live-editor";
import type { ThemeVars } from "@elkdonis/services";
import { saveProfileFieldAction, saveAvatarAction } from "@/lib/profile-editor-actions";
import { saveMyIfacThemeAction } from "@/lib/theme-actions";
import { IFAC_THEME_VARS } from "@/lib/theme-tokens";

export interface ProfileEditorPanelProps {
  profileUserId: string;
  slug: string;
  bio: string;
  avatarUrl: string;
  /** This person's own saved colour overrides, unmerged. */
  themeOverrides: ThemeVars;
  /** Whether the viewer IS this person, as opposed to an admin editing them. */
  isSelf: boolean;
}

/**
 * The owner-only editing chrome for IFAC's own artist/dealer pages: the
 * LiveEditor control bar (bio, pinned via the page's own data-trait="bio"
 * marker) and a "change portrait" upload control.
 *
 * The gallery itself isn't in here — ProfileGallery renders for every
 * visitor (that's how the lightbox gets to non-owners too), just with
 * editable=false when the viewer isn't the owner. See the page component.
 *
 * Bio is the one field this page displays that's self-owned (users.bio)
 * rather than org-controlled — role_title, for instance, is IFAC's own call
 * (see /admin/directory), not the artist's, so it isn't offered here.
 *
 * Only rendered at all when the viewer owns this profile or is an admin —
 * see the page component for that gate. The server actions re-check
 * authorization themselves regardless (see profile-editor-actions.ts).
 */
export function ProfileEditorPanel({
  profileUserId,
  slug,
  bio,
  avatarUrl,
  themeOverrides,
  isSelf,
}: ProfileEditorPanelProps) {
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);

  const fields: FieldDef[] = [
    { trait: "bio", label: "Bio", input: "textarea", initialValue: bio, hint: "Blank lines separate paragraphs." },
  ];

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("memberSlug", slug);
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
    <>
      <LiveEditor
        fields={fields}
        role="Owner"
        onSaveField={(payload) => saveProfileFieldAction(profileUserId, payload)}
      />

      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 14 }}>
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "50%" }} />
        )}
        <span className="button-secondary" style={{ display: "inline-block" }}>
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

      {/* Colours live here rather than in the hub: the point of a live editor
          is seeing the change on the page it applies to. Only offered to the
          person themselves — an admin may fix someone's bio, but the palette
          of your own page is yours. saveMyIfacThemeAction writes to the
          signed-in user regardless, so an admin could not set it for someone
          else even if this rendered. */}
      {isSelf && (
        <>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setStylesOpen(true)}
            style={{ marginLeft: 10 }}
          >
            Page colours
          </button>

          {stylesOpen && (
            <CssPanel
              cssVars={IFAC_THEME_VARS}
              initialOverrides={themeOverrides}
              onSave={saveMyIfacThemeAction}
              onClose={() => setStylesOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}

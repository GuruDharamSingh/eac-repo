"use client";

import { useState } from "react";
// Imported straight from @elkdonis/live-editor, not re-exported through
// @elkdonis/ui: LiveEditor itself uses no Mantine, but the ui barrel
// declares Mantine as a dependency, so importing through it pulls Mantine
// into an app that is deliberately without it.
import { LiveEditor, type FieldDef } from "@elkdonis/live-editor";
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
  /** Open in edit mode straight away (arrived via ?edit=1 from the hub). */
  startEditing?: boolean;
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
 * (see /manage/directory), not the artist's, so it isn't offered here.
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
  startEditing = false,
}: ProfileEditorPanelProps) {
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
      {/* Colours live here rather than in the hub: the point of a live editor
          is seeing the change on the page it applies to. In edit mode the
          framed sections carry style pins (data-theme-vars on the page) and
          the bar has a Styles button for the full set. Only offered to the
          person themselves — an admin may fix someone's bio, but the palette
          of your own page is yours. saveMyIfacThemeAction writes to the
          signed-in user regardless, so an admin could not set it for someone
          else even if this were passed. */}
      <LiveEditor
        fields={fields}
        role={isSelf ? "Owner" : "Admin"}
        initialEditMode={startEditing}
        onSaveField={(payload) => saveProfileFieldAction(profileUserId, payload)}
        cssVars={isSelf ? IFAC_THEME_VARS : undefined}
        cssOverrides={isSelf ? themeOverrides : undefined}
        onSaveCss={isSelf ? saveMyIfacThemeAction : undefined}
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

    </>
  );
}

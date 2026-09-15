"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceDescriptor, SurfaceProfile, SurfaceProfileLink } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";

// ============================================================================
// The flip side of a profile card.
//
// A person's network-wide identity — the ArtDirect profile, one row in
// `users` — read and edited here, wherever the card was clicked. With a
// `target` it is an organisation's identity instead (the org's own `users`
// row since migration 099), which is how an org finally gets a display
// image without leaving its site.
//
// The rail is the card itself: the portrait, the avatar control, and the
// doors out (the public page, files, the blog, the store). The main pane is
// the fields. Saving goes through the host's connector; the surface never
// knows which table it wrote.
//
// Tailwind utilities are used here on purpose (the owner's call for the
// center work); colours still come from the surface tokens so an org's
// theme carries through.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "profile" }>;

const FIELD =
  "w-full rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] px-3 py-2 text-[0.95rem] text-[color:var(--sf-fg)] outline-none focus:border-[color:var(--sf-accent)]";
const LABEL =
  "block font-[family-name:var(--sf-font-record)] text-[0.64rem] uppercase tracking-[0.14em] text-[color:var(--sf-muted)] mb-1";

export function ProfileSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const target = descriptor.target;

  const [profile, setProfile] = React.useState<SurfaceProfile | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [draft, setDraft] = React.useState<{
    displayName: string;
    headline: string;
    bio: string;
    pronouns: string;
    city: string;
    region: string;
    country: string;
    avatarUrl: string | null;
    socialLinks: SurfaceProfileLink[];
  } | null>(null);
  // Which half is showing. The face offers both doors, so a member who came
  // to check what was waiting for them never lands in a form they did not ask
  // for — the old behaviour, where canEdit meant "always editing".
  const [editing, setEditing] = React.useState(descriptor.mode === "edit");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    if (!connectors.profile) {
      setState("missing");
      return;
    }
    setState("loading");
    try {
      const p = await connectors.profile.load(target);
      if (!p) {
        setState("missing");
        return;
      }
      setProfile(p);
      setDraft({
        displayName: p.displayName,
        headline: p.headline ?? "",
        bio: p.bio ?? "",
        pronouns: p.pronouns ?? "",
        city: p.city ?? "",
        region: p.region ?? "",
        country: p.country ?? "",
        avatarUrl: p.avatarUrl,
        socialLinks: p.socialLinks,
      });
      setState("ready");
    } catch {
      setState("error");
    }
  }, [connectors, target]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    layer.setMeta({
      title: profile?.displayName ?? (target ? "Organisation" : "Your profile"),
      kind: "neutral",
      size: "wide",
    });
  }, [layer, profile, target]);

  const kicker = target
    ? "Organisation · identity on the collective"
    : "You · identity across the collective";

  if (state !== "ready" || !profile || !draft) {
    return (
      <SurfaceFrame kind="neutral" title={target ? "Organisation" : "Your profile"} kicker={kicker}>
        {state === "loading" && <SurfaceSkeleton block />}
        {state === "missing" && (
          <p className="eac-surface-empty">
            {connectors.profile ? "There is no profile to show." : "This site cannot open profiles yet."}
          </p>
        )}
        {state === "error" && (
          <p className="eac-surface-empty">
            Could not load it.{" "}
            <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
      </SurfaceFrame>
    );
  }

  const canEdit = profile.canEdit;
  const isEditing = canEdit && editing;
  const alerts = profile.alerts;

  async function save() {
    if (!connectors.profile || !draft) return;
    setSaving(true);
    setNotice(null);
    const nz = (v: string) => (v.trim() ? v.trim() : null);
    const result = await connectors.profile.save(target, {
      displayName: draft.displayName.trim() || profile!.displayName,
      headline: nz(draft.headline),
      bio: nz(draft.bio),
      pronouns: nz(draft.pronouns),
      city: nz(draft.city),
      region: nz(draft.region),
      country: nz(draft.country),
      avatarUrl: draft.avatarUrl,
      socialLinks: draft.socialLinks.filter((l) => l.url.trim()),
    });
    setSaving(false);
    if (result.ok === false) {
      setTone("error");
      setNotice(result.error);
      return;
    }
    setTone("normal");
    setNotice("Saved");
    connectors.onMutated?.();
    void load();
  }

  async function onPickAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file || !connectors.profile?.uploadAvatar) return;
    setUploading(true);
    setNotice(null);
    const r = await connectors.profile.uploadAvatar(file);
    setUploading(false);
    if (r.ok === false) {
      setTone("error");
      setNotice(r.error);
      return;
    }
    const url = r.url;
    setDraft((d) => (d ? { ...d, avatarUrl: url } : d));
    setTone("normal");
    setNotice("Photo uploaded — save to keep it");
  }

  const actions: SurfaceAction[] = [];
  if (isEditing) {
    actions.push({ label: saving ? "Saving…" : "Save", primary: true, disabled: saving, onClick: save });
    actions.push({ label: "Done", quiet: true, onClick: () => setEditing(false) });
  } else if (canEdit) {
    actions.push({ label: "Edit", primary: true, onClick: () => setEditing(true) });
  }
  if (profile.pageHref) actions.push({ label: target ? "Open page" : "Your page", href: profile.pageHref, quiet: true });
  if (!target && connectors.viewer.canCompose) {
    actions.push({ label: "Write a post", quiet: true, onClick: () => push({ type: "write", kind: "post" }) });
  }

  const rail = (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] aspect-[3/4]">
        {draft.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-4xl text-[color:var(--sf-faint)]" aria-hidden>
            {target ? "◆" : "◯"}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-[color:var(--sf-bg)]/90 px-3 py-2 backdrop-blur">
          <div className="font-[family-name:var(--sf-font-title)] text-lg leading-tight">{draft.displayName || profile.displayName}</div>
          {draft.headline && <div className="text-xs text-[color:var(--sf-muted)]">{draft.headline}</div>}
        </div>
      </div>
      {isEditing && connectors.profile?.uploadAvatar && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickAvatar(e.target.files)}
          />
          <button
            type="button"
            className="eac-btn eac-btn--quiet"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : draft.avatarUrl ? "Change photo" : "Add a photo"}
          </button>
          {draft.avatarUrl && (
            <button
              type="button"
              className="eac-btn eac-btn--quiet"
              onClick={() => setDraft((d) => (d ? { ...d, avatarUrl: null } : d))}
            >
              Remove
            </button>
          )}
        </div>
      )}
      {(profile.hrefs?.files || profile.hrefs?.blog || profile.hrefs?.store) && (
        <nav className="flex flex-wrap gap-2" aria-label="Doors">
          {profile.hrefs?.files && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.files}>Files</a>}
          {profile.hrefs?.blog && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.blog}>Blog</a>}
          {profile.hrefs?.store && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.store}>Store</a>}
        </nav>
      )}
    </div>
  );

  const set = <K extends keyof NonNullable<typeof draft>>(k: K, v: NonNullable<typeof draft>[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <SurfaceFrame
      kind="neutral"
      title={profile.displayName}
      kicker={kicker}
      rail={rail}
      actions={actions}
      status={notice}
      statusTone={tone}
    >
      {!isEditing ? (
        <div className="grid gap-3">
          {alerts && (alerts.unreadMessages || alerts.notifications || alerts.upcoming) ? (
            // Counted, never linked. No host in the network has an inbox route
            // yet, and a number that is true is worth more than a button that
            // goes nowhere.
            <ul className="flex flex-wrap gap-2" aria-label="Waiting for you">
              {alerts.unreadMessages ? (
                <li className="eac-chip">{alerts.unreadMessages} unread</li>
              ) : null}
              {alerts.notifications ? (
                <li className="eac-chip">
                  {alerts.notifications} notification{alerts.notifications === 1 ? "" : "s"}
                </li>
              ) : null}
              {alerts.upcoming ? (
                <li className="eac-chip">{alerts.upcoming} upcoming</li>
              ) : null}
            </ul>
          ) : alerts ? (
            <p className="text-sm text-[color:var(--sf-muted)]">Nothing waiting.</p>
          ) : null}
          {profile.headline && (
            <p className="text-[0.95rem] text-[color:var(--sf-muted)]">{profile.headline}</p>
          )}
          {profile.bio && <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{profile.bio}</p>}
          {[profile.city, profile.region, profile.country].filter(Boolean).length > 0 && (
            <p className="text-sm text-[color:var(--sf-muted)]">
              {[profile.city, profile.region, profile.country].filter(Boolean).join(", ")}
            </p>
          )}
          {profile.socialLinks.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {profile.socialLinks.map((l) => (
                <li key={l.url}>
                  <a className="eac-btn eac-btn--quiet" href={l.url} target="_blank" rel="noopener">
                    {l.label ?? l.url.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={LABEL}>{target ? "Name" : "Display name"}</span>
              <input className={FIELD} value={draft.displayName} onChange={(e) => set("displayName", e.target.value)} required />
            </label>
            <label className="sm:col-span-2">
              <span className={LABEL}>Headline</span>
              <input className={FIELD} value={draft.headline} onChange={(e) => set("headline", e.target.value)} placeholder={target ? "What the organisation does, in a line" : "What you do, in a line"} />
            </label>
            {!target && (
              <label>
                <span className={LABEL}>Pronouns</span>
                <input className={FIELD} value={draft.pronouns} onChange={(e) => set("pronouns", e.target.value)} />
              </label>
            )}
            <label>
              <span className={LABEL}>City</span>
              <input className={FIELD} value={draft.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Region</span>
              <input className={FIELD} value={draft.region} onChange={(e) => set("region", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Country</span>
              <input className={FIELD} value={draft.country} onChange={(e) => set("country", e.target.value)} />
            </label>
            <label className="sm:col-span-2">
              <span className={LABEL}>{target ? "About" : "Statement"}</span>
              <textarea className={`${FIELD} min-h-[8rem]`} value={draft.bio} onChange={(e) => set("bio", e.target.value)} />
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className={LABEL}>Elsewhere</legend>
            {draft.socialLinks.map((l, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
                <input
                  className={FIELD}
                  placeholder="Label"
                  value={l.label ?? ""}
                  onChange={(e) =>
                    set("socialLinks", draft.socialLinks.map((x, j) => (j === i ? { ...x, label: e.target.value || null } : x)))
                  }
                />
                <input
                  className={FIELD}
                  placeholder="https://"
                  value={l.url}
                  onChange={(e) =>
                    set("socialLinks", draft.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="eac-btn eac-btn--quiet"
                  aria-label="Remove link"
                  onClick={() => set("socialLinks", draft.socialLinks.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="eac-btn eac-btn--quiet"
                onClick={() => set("socialLinks", [...draft.socialLinks, { label: null, url: "" }])}
              >
                + Add a link
              </button>
            </div>
          </fieldset>
          {/* Enter submits; the Save in the foot is the visible control. */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </SurfaceFrame>
  );
}

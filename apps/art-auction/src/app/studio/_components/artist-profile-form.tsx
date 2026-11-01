"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MultiImageUploader, type UploadedImage } from "@elkdonis/studio-ui";
import { Button } from "@/components/ui/button";
import {
  applyArtistAction,
  updateProfileAction,
  type ApplyArtistInput,
  type ArtistLinkInput,
} from "../actions";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const labelCls = "mb-1 block text-sm font-medium";
const hintCls = "mt-1 text-xs text-muted-foreground";

/** Store-local fields: the store's own note, links and (on apply) payout email. */
export type ArtistProfileInitial = {
  bioHtml?: string | null;
  payoutEmail?: string | null;
  links?: ArtistLinkInput[];
};

/**
 * The person's network profile (`users`), which a person's store shows as is.
 * Read on the server so the form can show it rather than ask for it again.
 */
export type NetworkProfile = {
  displayName: string | null;
  headline: string | null;
  city: string | null;
  photoUrl: string | null;
  /** Plain-text bio for the edit box; null when the bio carries HTML. */
  bioText: string | null;
  /** Sanitized HTML for the preview. */
  bioHtml: string;
  /** False when the bio was written with formatting on another site. */
  bioEditable: boolean;
  /** Their ArtDirect page, where the profile is edited in full. */
  profileUrl: string | null;
};

export function ArtistProfileForm({
  mode,
  initial,
  profile,
  storeKind = "user",
}: {
  mode: "apply" | "edit";
  initial?: ArtistProfileInitial;
  /** Required for a person's store; ignored for an org store. */
  profile?: NetworkProfile;
  /** An org store edits only its own blurb and links; identity is the org's. */
  storeKind?: "user" | "org";
}) {
  // Identity belongs to a person. Payout email is collected on apply only —
  // afterwards the studio's Payouts panel owns it (with Stripe).
  const isPerson = storeKind === "user";
  const showPayout = mode === "apply" && isPerson;
  const router = useRouter();

  // Someone whose first stop in the network is the marketplace has no name
  // yet, so the profile fields start open for them and closed for everyone
  // who already brought a profile from another site.
  const [editingProfile, setEditingProfile] = React.useState(
    isPerson && !profile?.displayName
  );
  const [displayName, setDisplayName] = React.useState(profile?.displayName ?? "");
  const [headline, setHeadline] = React.useState(profile?.headline ?? "");
  const [city, setCity] = React.useState(profile?.city ?? "");
  const [photo, setPhoto] = React.useState<UploadedImage[]>(
    profile?.photoUrl ? [{ url: profile.photoUrl }] : []
  );
  const [profileBio, setProfileBio] = React.useState(profile?.bioText ?? "");

  const [payoutEmail, setPayoutEmail] = React.useState(initial?.payoutEmail ?? "");
  const [storeNote, setStoreNote] = React.useState(initial?.bioHtml ?? "");
  const [links, setLinks] = React.useState<ArtistLinkInput[]>(initial?.links ?? []);
  const [pending, setPending] = React.useState(false);

  function setLink(i: number, patch: Partial<ArtistLinkInput>) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPerson && !displayName.trim()) return toast.error("Your name is required.");
    if (showPayout && !payoutEmail.trim()) return toast.error("An eTransfer payout email is required.");

    // Profile fields travel only when the person opened them, so saving the
    // store never rewrites a profile someone edited on another site meanwhile.
    const profileFields: Partial<ApplyArtistInput> =
      isPerson && editingProfile
        ? {
            headline,
            city,
            photoUrl: photo[0]?.url ?? "",
            ...(profile?.bioEditable !== false ? { profileBio } : {}),
          }
        : {};

    const input: ApplyArtistInput = {
      // Apply needs a name even when it came from the profile unchanged.
      displayName: isPerson && (editingProfile || mode === "apply") ? displayName : "",
      ...profileFields,
      bioHtml: storeNote,
      payoutEmail,
      links: links.filter((l) => l.url.trim().length > 0),
    };

    setPending(true);
    try {
      const res =
        mode === "apply"
          ? await applyArtistAction(input)
          : await updateProfileAction(input);
      if (!res.ok) return toast.error(res.error ?? "Failed.");
      toast.success(mode === "apply" ? "Application submitted." : "Saved.");
      router.refresh();
      if (mode === "apply") router.push("/studio/apply");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isPerson && (
        <section className="rounded-lg border border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">Your profile</h3>
              <p className={hintCls}>
                Your store shows your network profile — the same name, photo and
                bio as on ArtDirect and the other collective sites.
              </p>
            </div>
            {/* Once open the fields stay open: closing them would hide edits that are still sent. */}
            {!editingProfile && (
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="shrink-0 text-sm underline underline-offset-4"
              >
                Edit profile
              </button>
            )}
          </div>

          {!editingProfile ? (
            <div className="mt-4 flex gap-4">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {profile?.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-serif text-xl">{profile?.displayName}</p>
                {(profile?.headline || profile?.city) && (
                  <p className="text-sm text-muted-foreground">
                    {[profile?.headline, profile?.city].filter(Boolean).join(" · ")}
                  </p>
                )}
                {profile?.bioHtml ? (
                  <div
                    className="prose prose-sm mt-2 line-clamp-4 max-w-none text-foreground/80"
                    dangerouslySetInnerHTML={{ __html: profile.bioHtml }}
                  />
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No bio yet.{" "}
                    <button
                      type="button"
                      onClick={() => setEditingProfile(true)}
                      className="underline underline-offset-4"
                    >
                      Add one
                    </button>
                  </p>
                )}
                {!profile?.photoUrl && (
                  <p className={hintCls}>No photo yet — add one under Edit profile.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                Changes here update your profile on every network site, not
                only this store.
              </p>
              <div>
                <label className={labelCls} htmlFor="displayName">
                  Your name
                </label>
                <input
                  id="displayName"
                  className={inputCls}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className={inputCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="headline">
                  Headline
                </label>
                <input
                  id="headline"
                  className={inputCls}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Contemporary painter exploring light and memory"
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Photo</span>
                <MultiImageUploader
                  value={photo}
                  onChange={setPhoto}
                  uploadEndpoint="/api/upload"
                  maxImages={1}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="profileBio">
                  Bio
                </label>
                {profile?.bioEditable === false ? (
                  <p className="text-sm text-muted-foreground">
                    Your bio was written with formatting on another site, so it
                    is edited there
                    {profile.profileUrl && (
                      <>
                        {" "}
                        or on{" "}
                        <a href={profile.profileUrl} className="underline underline-offset-4">
                          your ArtDirect page
                        </a>
                      </>
                    )}
                    .
                  </p>
                ) : (
                  <textarea
                    id="profileBio"
                    className={`${inputCls} min-h-32`}
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="A few lines about you and your practice."
                  />
                )}
              </div>
            </div>
          )}
          {profile?.profileUrl && !editingProfile && (
            <a
              href={profile.profileUrl}
              className="mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4"
            >
              See your ArtDirect page →
            </a>
          )}
        </section>
      )}

      {showPayout && (
        <div className="max-w-md">
          <label className={labelCls} htmlFor="payoutEmail">
            Payout email (eTransfer)
          </label>
          <input
            id="payoutEmail"
            type="email"
            className={inputCls}
            value={payoutEmail}
            onChange={(e) => setPayoutEmail(e.target.value)}
            required
          />
          <p className={hintCls}>
            Where buyers send eTransfers. Card payouts via Stripe can be added after approval.
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>
          {isPerson ? "Store note (optional)" : "About the store"}
        </label>
        {isPerson && (
          <p className={`${hintCls} mb-2 mt-0`}>
            Shown on your store page above your profile bio — for what this
            store is about: a series, commissions, shipping. Leave it empty to
            show your profile bio alone.
          </p>
        )}
        <RichTextEditor
          value={storeNote}
          onChange={setStoreNote}
          placeholder={isPerson ? "What collectors will find here…" : "Tell collectors about the store…"}
        />
      </div>

      <div className="space-y-2">
        <span className={labelCls}>Store links</span>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Label"
              value={l.label}
              onChange={(e) => setLink(i, { label: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="https://"
              value={l.url}
              onChange={(e) => setLink(i, { url: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))}
              className="rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          + Add link
        </button>
      </div>

      <Button type="submit" disabled={pending}>
        {mode === "apply" ? "Submit application" : "Save"}
      </Button>
    </form>
  );
}

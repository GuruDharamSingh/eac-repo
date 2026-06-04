"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/studio-ui";
import {
  applyArtistAction,
  updateProfileAction,
  type ApplyArtistInput,
  type ArtistLinkInput,
} from "../actions";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-[2px] focus:ring-ring/50";
const labelCls = "mb-1 block text-sm font-medium";

export type ArtistProfileInitial = {
  displayName?: string | null;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  bioHtml?: string | null;
  payoutEmail?: string | null;
  links?: ArtistLinkInput[];
};

export function ArtistProfileForm({
  mode,
  initial,
}: {
  mode: "apply" | "edit";
  initial?: ArtistProfileInitial;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState(
    initial?.displayName ?? ""
  );
  const [headline, setHeadline] = React.useState(initial?.headline ?? "");
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [photoUrl, setPhotoUrl] = React.useState(initial?.photoUrl ?? "");
  const [payoutEmail, setPayoutEmail] = React.useState(
    initial?.payoutEmail ?? ""
  );
  const [bioHtml, setBioHtml] = React.useState(initial?.bioHtml ?? "");
  const [links, setLinks] = React.useState<ArtistLinkInput[]>(
    initial?.links ?? []
  );
  const [pending, setPending] = React.useState(false);

  function setLink(i: number, patch: Partial<ArtistLinkInput>) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return toast.error("A display name is required.");
    if (!payoutEmail.trim()) return toast.error("A payout email is required.");

    const input: ApplyArtistInput = {
      displayName,
      headline,
      city,
      photoUrl,
      bioHtml,
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
      toast.success(
        mode === "apply" ? "Application submitted." : "Profile saved."
      );
      router.refresh();
      if (mode === "apply") router.push("/studio/apply");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="displayName">
            Display name
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
        <div>
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
        </div>
        <div>
          <label className={labelCls} htmlFor="photoUrl">
            Photo URL
          </label>
          <input
            id="photoUrl"
            className={inputCls}
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="/api/media/…"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Bio</label>
        <RichTextEditor
          value={bioHtml}
          onChange={setBioHtml}
          placeholder="Tell collectors about your practice…"
        />
      </div>

      <div className="space-y-2">
        <span className={labelCls}>Links</span>
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {mode === "apply" ? "Submit application" : "Save profile"}
      </button>
    </form>
  );
}

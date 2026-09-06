"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  OrgIdentityInput,
  SaveOrgIdentityResult,
} from "@/lib/org-identity-actions";

/**
 * The org's own identity — distinct from any member's profile.
 *
 * Until migration 099 there was nowhere to put this, and the org's public
 * page borrowed an arbitrary member's photo and bio. Location is not
 * decoration: it's what a per-org "what's on near us" view will key on.
 */
export function OrgIdentityPanel({
  orgId,
  initial,
  onSave,
}: {
  orgId: string;
  initial: OrgIdentityInput;
  onSave: (orgId: string, input: OrgIdentityInput) => Promise<SaveOrgIdentityResult>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OrgIdentityInput>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof OrgIdentityInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const res = await onSave(orgId, form);
          if (res.ok) {
            setMessage("Saved.");
            router.refresh();
          } else {
            setError(res.error ?? "Could not save.");
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={form.displayName ?? ""}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="What the org is called"
          />
        </Field>
        <Field label="Headline">
          <Input
            value={form.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="One line under the name"
          />
        </Field>
      </div>

      <Field label="About">
        <textarea
          value={form.bio ?? ""}
          onChange={(e) => set("bio", e.target.value)}
          rows={5}
          placeholder="Who you are and what you do."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Portrait URL">
        <Input
          value={form.avatarUrl ?? ""}
          onChange={(e) => set("avatarUrl", e.target.value)}
          placeholder="/api/media/... or an https:// image"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Region">
          <Input value={form.region ?? ""} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Location is what the community page will use to show what&rsquo;s on near you.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        {error && (
          <span className="text-sm text-destructive" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

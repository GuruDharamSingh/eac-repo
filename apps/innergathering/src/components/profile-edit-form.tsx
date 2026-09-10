"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOwnProfileAction } from "@/lib/account-actions";

interface ProfileEditFormProps {
  initial: {
    bio: string;
    photoUrl: string;
    city: string;
    slug: string;
  };
}

/**
 * Self-service identity editor for /account. This is the "always editable
 * by the artist themself" surface — org owners separately control whether
 * and how it's published (see /manage/people), but the content is yours.
 */
export function ProfileEditForm({ initial }: ProfileEditFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);

  function save() {
    startTransition(async () => {
      const res = await updateOwnProfileAction(form);
      if (res.ok) {
        toast.success("Profile saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-slug">Page address</Label>
          <Input
            id="profile-slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="your-name"
          />
          <p className="text-xs text-muted-foreground">
            Used wherever you're published — /about/{form.slug || "…"} here, and on ArtDirect.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-city">City</Label>
          <Input
            id="profile-city"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Toronto"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          rows={5}
        />
        <p className="text-xs text-muted-foreground">Blank lines separate paragraphs.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-photo">Photo URL</Label>
        <Input
          id="profile-photo"
          type="url"
          value={form.photoUrl}
          onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        />
      </div>

      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}

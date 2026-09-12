"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfileAction, type ProfileFormInput } from "@/app/hub/profile/actions";

const textareaClass =
  "min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ProfileForm({ initial }: { initial: ProfileFormInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProfileFormInput>(k: K, val: ProfileFormInput[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveProfileAction(v);
          if (res.ok) {
            toast.success("Profile saved");
            router.refresh();
          } else toast.error(res.error ?? "Could not save");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Name</Label>
          <Input id="displayName" required maxLength={120} value={v.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pronouns">Pronouns</Label>
          <Input id="pronouns" maxLength={40} value={v.pronouns ?? ""} onChange={(e) => set("pronouns", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input id="headline" maxLength={160} placeholder="One line about what you do" value={v.headline ?? ""} onChange={(e) => set("headline", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle">Role here</Label>
          <Input id="roleTitle" maxLength={120} placeholder="e.g. Astrology" value={v.roleTitle ?? ""} onChange={(e) => set("roleTitle", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" maxLength={120} value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <textarea id="bio" className={textareaClass} maxLength={5000} value={v.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-primary" checked={v.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />
        Listed publicly on /people
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

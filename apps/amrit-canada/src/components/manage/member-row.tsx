"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { OrgRole } from "@elkdonis/services";
import { saveGuideProfileAction, setMemberRoleAction } from "@/lib/cms/actions";
import { Button, Input, Label, Textarea, Switch, Badge, Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@elkdonis/primitives";

interface MemberRowProps {
  member: {
    userId: string;
    email: string;
    displayName: string | null;
    role: OrgRole;
    joinedAt: string;
  };
  profile: {
    slug: string;
    displayName: string;
    roleTitle: string;
    bio: string;
    photoUrl: string;
    city: string;
    sortOrder: number;
    isPublic: boolean;
  } | null;
  canManage: boolean;
  isSelf: boolean;
}

const ROLES: OrgRole[] = ["owner", "guide", "member", "viewer"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function MemberRow({ member, profile, canManage, isSelf }: MemberRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const [form, setForm] = useState({
    slug: profile?.slug ?? slugify(member.displayName ?? member.email.split("@")[0]),
    displayName: profile?.displayName || member.displayName || "",
    roleTitle: profile?.roleTitle ?? "",
    bio: profile?.bio ?? "",
    photoUrl: profile?.photoUrl ?? "",
    city: profile?.city ?? "",
    sortOrder: String(profile?.sortOrder ?? 0),
    isPublic: profile?.isPublic ?? false,
  });

  function changeRole(role: OrgRole) {
    startTransition(async () => {
      const res = await setMemberRoleAction(member.userId, role);
      if (res.ok) {
        toast.success("Role updated.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not change the role.");
      }
    });
  }

  function saveProfile() {
    startTransition(async () => {
      const res = await saveGuideProfileAction({
        userId: member.userId,
        slug: form.slug,
        displayName: form.displayName || member.email,
        roleTitle: form.roleTitle,
        bio: form.bio,
        photoUrl: form.photoUrl,
        city: form.city,
        sortOrder: Number(form.sortOrder) || 0,
        isPublic: form.isPublic,
      });
      if (res.ok) {
        toast.success(form.isPublic ? "Profile published." : "Profile saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              {member.displayName ?? member.email}
              {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
            </p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile?.isPublic && <Badge variant="secondary">Published</Badge>}

            {canManage ? (
              <Select
                value={member.role}
                onValueChange={(v) => changeRole(v as OrgRole)}
                disabled={pending}
              >
                <SelectTrigger className="w-32" aria-label={`Role for ${member.email}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="capitalize">
                {member.role}
              </Badge>
            )}

            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Close" : profile?.isPublic ? "Edit page" : "Give a page"}
              </Button>
            )}
          </div>
        </div>

        {expanded && canManage && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`name-${member.userId}`}>Display name</Label>
                <Input
                  id={`name-${member.userId}`}
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`slug-${member.userId}`}>Page address</Label>
                <Input
                  id={`slug-${member.userId}`}
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">/about/{form.slug || "…"}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`title-${member.userId}`}>Role</Label>
                <Input
                  id={`title-${member.userId}`}
                  value={form.roleTitle}
                  onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
                  placeholder="Teacher · KRI Certified"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`city-${member.userId}`}>City</Label>
                <Input
                  id={`city-${member.userId}`}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Toronto"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`bio-${member.userId}`}>Bio</Label>
              <Textarea
                id={`bio-${member.userId}`}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Blank lines separate paragraphs.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`photo-${member.userId}`}>Photo URL</Label>
                <Input
                  id={`photo-${member.userId}`}
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`order-${member.userId}`}>Order on /about</Label>
                <Input
                  id={`order-${member.userId}`}
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id={`public-${member.userId}`}
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
              <Label htmlFor={`public-${member.userId}`} className="font-normal">
                Show this profile publicly on /about
              </Label>
            </div>

            <Button onClick={saveProfile} disabled={pending} size="sm">
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

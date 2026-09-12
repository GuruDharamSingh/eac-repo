import Link from "next/link";
import type { Metadata } from "next";
import { getProfile, listOrgProfiles } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { ProfileForm } from "@/components/hub/profile-form";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function HubProfilePage() {
  const viewer = await requireOrgMember("/hub/profile");
  const [profile, listings] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    listOrgProfiles(siteConfig.orgId, { onlyPublic: false }).catch(() => []),
  ]);
  const listing = listings.find((l) => l.userId === viewer.userId) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/hub" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← Hub
      </Link>
      <h1 className="mt-4 text-3xl font-semibold md:text-4xl">My profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your name, headline and bio are shared across the whole Elkdonis network; the role and the public switch
        apply to {siteConfig.orgName} only.
        {profile?.slug && (
          <>
            {" "}
            Public page:{" "}
            <Link href={`/people/${profile.slug}`} className="text-primary underline underline-offset-4">
              /people/{profile.slug}
            </Link>
          </>
        )}
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <ProfileForm
          initial={{
            displayName: profile?.displayName ?? viewer.email,
            headline: profile?.headline ?? "",
            bio: profile?.bio ?? "",
            pronouns: profile?.pronouns ?? "",
            city: profile?.city ?? "",
            roleTitle: listing?.roleTitle ?? "",
            isPublic: listing?.isPublic ?? true,
          }}
        />
      </div>
    </div>
  );
}

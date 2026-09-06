import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { getProfile } from "@elkdonis/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Your account" };

interface RsvpRow {
  thread_id: string;
  title: string;
  section: string | null;
  slug: string;
  scheduled_at: Date | null;
  status: string;
}

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  const profile = await getProfile(viewer.userId);

  // What this person has said they're coming to, on this site only.
  const rsvps = await db<RsvpRow[]>`
    SELECT r.thread_id, t.title, t.section, t.slug, t.scheduled_at, r.status
    FROM thread_rsvps r
    JOIN threads t ON t.id = r.thread_id
    WHERE r.user_id = ${viewer.userId}
      AND t.org_id = ${siteConfig.orgId}
      AND r.status = 'yes'
    ORDER BY t.scheduled_at ASC NULLS LAST
    LIMIT 25
  `.catch(() => [] as RsvpRow[]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-serif text-3xl">Your account</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Sign-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{viewer.email}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Role here</span>
            {viewer.role ? (
              <Badge variant="secondary" className="capitalize">
                {viewer.role}
              </Badge>
            ) : (
              <Badge variant="outline">Visitor</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            This account works across every site in the Elkdonis network. Your role is set
            separately on each one.
          </p>
          <div className="flex gap-2 pt-2">
            {viewer.canEdit && (
              <Button asChild size="sm">
                <Link href="/manage">Manage the site</Link>
              </Button>
            )}
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            This is yours to write — it's the same profile wherever you're published across the
            network, including ArtDirect. An org can decide whether and how it appears on their
            site, but never what it says.
          </p>
          <ProfileEditForm
            initial={{
              bio: profile?.bio ?? "",
              photoUrl: profile?.avatarUrl ?? "",
              city: profile?.city ?? "",
              slug: profile?.slug ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">You said you&rsquo;re coming to</CardTitle>
        </CardHeader>
        <CardContent>
          {rsvps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. RSVPs you make on gatherings will show up here.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rsvps.map((r) => (
                <li key={r.thread_id}>
                  <Link
                    href={r.section ? `/${r.section}/${r.slug}` : "#"}
                    className="underline underline-offset-2"
                  >
                    {r.title}
                  </Link>
                  {r.scheduled_at && (
                    <span className="ml-2 text-muted-foreground">
                      {new Date(r.scheduled_at).toLocaleDateString("en-CA", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

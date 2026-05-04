import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DISCIPLINE_LABELS,
  EXPERIENCE_LABELS,
  TEMPLATE_LABELS,
} from "@/lib/schema";

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-2 font-serif text-3xl">
            {profile?.display_name ?? user.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </header>

        {profile ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Artist profile</CardTitle>
              <CardDescription>
                What you gave the collective during onboarding. Nothing is
                locked — you can start over any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <Field label="Your org">
                <code className="font-mono">{profile.org_id}</code>
              </Field>
              <Field label="City">{profile.city}</Field>
              <Field label="Pronouns">{profile.pronouns || "—"}</Field>
              <Field label="Bio" multiline>
                {profile.bio}
              </Field>
              <Separator />
              <Field label="Disciplines">
                {profile.disciplines
                  .map(
                    (d) =>
                      DISCIPLINE_LABELS[
                        d as keyof typeof DISCIPLINE_LABELS
                      ] ?? d
                  )
                  .join(", ") || "—"}
              </Field>
              <Field label="Level">
                {profile.experience_level
                  ? EXPERIENCE_LABELS[
                      profile.experience_level as keyof typeof EXPERIENCE_LABELS
                    ] ?? profile.experience_level
                  : "—"}
              </Field>
              <Separator />
              <Field label="Template">
                {profile.template_preference
                  ? TEMPLATE_LABELS[
                      profile.template_preference as keyof typeof TEMPLATE_LABELS
                    ]?.title ?? profile.template_preference
                  : "—"}
              </Field>
              <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/wizard/confirm">Review full submission</Link>
                </Button>
                <Button asChild>
                  <Link href="/hub">Back to hub</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                You&apos;re signed in as a member
              </CardTitle>
              <CardDescription>
                You don&apos;t have an artist profile yet. You&apos;ve joined
                the collective as a member of one or more orgs. When
                you&apos;re ready to create your own corner, start the
                onboarding wizard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Field label="Email">{user.email}</Field>
              <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                <Button asChild>
                  <Link href="/wizard">Start artist onboarding</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/commitments">Your commitments</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}

function Field({
  label,
  children,
  multiline,
}: {
  label: string;
  children: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={multiline ? "whitespace-pre-wrap" : undefined}>
        {children}
      </dd>
    </div>
  );
}

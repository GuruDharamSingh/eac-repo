import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, isProfileComplete } from "@/lib/profile";
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
  AUDIENCE_TYPE_LABELS,
  CLIENT_BASE_LABELS,
  DISCIPLINE_LABELS,
  EXPERIENCE_LABELS,
  FEATURE_LABELS,
  GOALS_OPTION_LABELS,
  NEED_LABELS,
  TEMPLATE_LABELS,
} from "@/lib/schema";
import { startOverAction } from "./actions";

function joinLabels(
  keys: string[] | null | undefined,
  dict: Record<string, string>
): string {
  if (!keys || keys.length === 0) return "—";
  return keys.map((k) => dict[k] ?? k).join(", ");
}

export default async function ConfirmPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  if (!profile) redirect("/wizard");
  if (!isProfileComplete(profile)) redirect("/wizard");

  return (
    <div className="mx-auto max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl">
            Welcome back, {profile.display_name}.
          </CardTitle>
          <CardDescription>
            Here&apos;s what you told us. If it still fits, you&apos;re done.
            Otherwise you can start over.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section title="You">
            <Fact label="Display name" value={profile.display_name} />
            {profile.pronouns && (
              <Fact label="Pronouns" value={profile.pronouns} />
            )}
            <Fact label="City" value={profile.city} />
            <Fact label="Bio" value={profile.bio} multiline />
          </Section>

          <Section title="Practice">
            <Fact
              label="Disciplines"
              value={joinLabels(profile.disciplines, DISCIPLINE_LABELS)}
            />
            {profile.disciplines_other && (
              <Fact label="Also" value={profile.disciplines_other} />
            )}
            <Fact
              label="Level"
              value={
                profile.experience_level
                  ? EXPERIENCE_LABELS[
                      profile.experience_level as keyof typeof EXPERIENCE_LABELS
                    ] ?? profile.experience_level
                  : "—"
              }
            />
          </Section>

          <Section title="Audience">
            {profile.portfolio_url && (
              <Fact label="Work" value={profile.portfolio_url} />
            )}
            <Fact
              label="Types"
              value={joinLabels(profile.audience_types, AUDIENCE_TYPE_LABELS)}
            />
            <Fact
              label="Clients"
              value={joinLabels(profile.client_base, CLIENT_BASE_LABELS)}
            />
            {profile.audience_description && (
              <Fact
                label="Notes"
                value={profile.audience_description}
                multiline
              />
            )}
          </Section>

          <Section title="Goals & mutual aid">
            <Fact
              label="Here for"
              value={joinLabels(profile.goals_options, GOALS_OPTION_LABELS)}
            />
            {profile.goals_seeking && (
              <Fact label="Notes" value={profile.goals_seeking} multiline />
            )}
            <Fact
              label="Share media"
              value={profile.mutual_aid_media ? "Yes" : "No"}
            />
            <Fact
              label="Author under EAC"
              value={profile.mutual_aid_authoring ? "Yes" : "No"}
            />
          </Section>

          <Section title="Your view">
            {profile.personal_philosophy && (
              <Fact
                label="Philosophy"
                value={profile.personal_philosophy}
                multiline
              />
            )}
            <Fact
              label="Aesthetics"
              value={
                profile.aesthetic_keywords.length
                  ? profile.aesthetic_keywords.join(", ")
                  : "—"
              }
            />
            {profile.aesthetic_notes && (
              <Fact label="Notes" value={profile.aesthetic_notes} multiline />
            )}
          </Section>

          <Section title="Where we can help">
            <Fact
              label="Needs"
              value={joinLabels(profile.needs, NEED_LABELS)}
            />
          </Section>

          <Section title="Features">
            <Fact
              label="Requested"
              value={joinLabels(profile.features_requested, FEATURE_LABELS)}
            />
            {profile.features_other && (
              <Fact
                label="Other"
                value={profile.features_other}
                multiline
              />
            )}
          </Section>

          <Section title="Template">
            <Fact
              label="Archetype"
              value={
                profile.template_preference
                  ? TEMPLATE_LABELS[
                      profile.template_preference as keyof typeof TEMPLATE_LABELS
                    ]?.title ?? profile.template_preference
                  : "—"
              }
            />
            {profile.palette_preference && (
              <Fact label="Palette" value={profile.palette_preference} />
            )}
          </Section>

          <Separator />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form action={startOverAction}>
              <Button type="submit" variant="outline">
                Start over
              </Button>
            </form>
            <Button asChild>
              <Link href="/hub">Looks good</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 font-serif text-lg">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[140px_1fr]">
        {children}
      </dl>
    </div>
  );
}

function Fact({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={multiline ? "whitespace-pre-wrap text-sm" : "text-sm"}>
        {value || "—"}
      </dd>
    </>
  );
}

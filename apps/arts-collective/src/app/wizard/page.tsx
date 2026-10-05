import { redirect } from "next/navigation";
import Link from "next/link";
import { gainSpace } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import {
  getProfileForUser,
  isProfileComplete,
  profileToAnswers,
} from "@/lib/profile";
import { ArtistProfileWizard } from "@/components/wizard/ArtistProfileWizard";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

export default async function WizardPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await requireUser();
  // Starting the artist onboarding gains the person's space in the collective
  // (oad membership, ArtDirect listing, storage folder, profile row). No org
  // of their own is needed. Idempotent, so every visit may call it.
  await gainSpace(user.id);
  const profile = await getProfileForUser(user.id);
  if (!profile) redirect("/hub");

  const complete = isProfileComplete(profile);
  // A completed profile lands on the summary; `?edit=1` (linked from there)
  // reopens the wizard on the saved answers.
  if (complete && edit !== "1") {
    redirect("/wizard/confirm");
  }

  return (
    <div className="py-4">
      <div className="mb-2 px-6">
        <Link
          href="/hub/elkdonis"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Hub
        </Link>
      </div>
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="font-serif text-2xl leading-tight">
          {complete ? "Edit artist profile" : "Artist profile"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump to any section from the steps below. Your answers save as you go
          — you can leave and come back.
        </p>
      </div>
      <ArtistProfileWizard
        storageKey={user.id}
        initialAnswers={profileToAnswers(profile)}
        serverUpdatedAt={profile.updated_at?.toISOString() ?? null}
        editing={complete}
      />
    </div>
  );
}

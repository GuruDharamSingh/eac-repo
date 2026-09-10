import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getProfileForUser,
  isProfileComplete,
  profileToAnswers,
} from "@/lib/profile";
import { WizardProvider } from "@/components/wizard/WizardProvider";
import { WizardRenderer } from "@/components/wizard/WizardRenderer";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

export default async function WizardPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  if (!profile) {
    // User hasn't set up their org yet — send them through setup first.
    redirect("/signup/setup");
  }

  if (isProfileComplete(profile)) {
    redirect("/wizard/confirm");
  }

  const initial = profileToAnswers(profile);

  return (
    <WizardProvider userId={user.id} initialAnswers={initial}>
      <WizardRenderer />
    </WizardProvider>
  );
}

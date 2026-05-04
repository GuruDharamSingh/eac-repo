import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@elkdonis/db";
import { SiteShell } from "@/components/site-shell";
import { SetupForm } from "./setup-form";

async function hasOrgAsOwner(userId: string): Promise<boolean> {
  try {
    const rows = await db<{ org_id: string }[]>`
      SELECT org_id FROM user_organizations
      WHERE user_id = ${userId} AND role = 'owner'
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export default async function SignupSetupPage() {
  const user = await requireUser();
  if (await hasOrgAsOwner(user.id)) {
    redirect("/hub");
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-xl py-16">
        <header className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Welcome
          </p>
          <h1 className="font-serif text-3xl leading-tight">
            Claim your corner of the collective.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This is a work in progress — you can refine all of this over time.
            The more you give us now, the faster we can set up your presence.
          </p>
        </header>

        <SetupForm />
      </div>
    </SiteShell>
  );
}

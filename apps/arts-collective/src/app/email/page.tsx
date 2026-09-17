import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listUserMemberships } from "@elkdonis/services";
import type { EmailTab } from "@elkdonis/cms-ui/email";
import { SiteShell } from "@/components/site-shell";
import { EmailSuiteHost } from "@/components/hub/email/EmailSuiteHost";
import { guardOrgEmail, loadEmailSuite, emailRoutesFor } from "@/lib/email-suite";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Email" };
export const dynamic = "force-dynamic";

const TABS = new Set<EmailTab>(["activity", "inbox", "addresses", "letters", "look"]);

/**
 * The email suite — arts-collective.com/email?org=<slug>
 *
 * The network hub and not a per-org site, because email is the one capability
 * every organisation on this network is given: the suite has to show whichever
 * org the person is standing in, next to the switcher that changes it. The
 * fifteen single-tenant apps get the same thing as a hub FACE, opening the
 * same component in a popup — see EmailFace.
 *
 * TOP-LEVEL, not under /hub. Email is the one capability every organisation on
 * the network is given, so it is addressed like one: arts-collective.com/email
 * is a URL somebody can be told over the phone. It still uses the hub's session
 * and the hub's `?org=` convention, so switching between them never silently
 * changes which organisation you are looking at.
 *
 * Deliberately not a subdomain either. `email.arts-collective.com` resolves
 * (there is wildcard DNS) but has no certificate, and it would need its own
 * proxy host and its own session cookie to do what this already does with the
 * ones that exist.
 */
export default async function HubEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; tab?: string }>;
}) {
  const { org: orgParam, tab: tabParam } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/email");

  const memberships = await listUserMemberships(user.id);
  if (memberships.length === 0) {
    return (
      <SiteShell wide>
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <h1 className="font-serif text-3xl">Email</h1>
          <p className="mt-3 text-muted-foreground">
            Email belongs to an organisation. Once you&rsquo;re part of one,
            everything it sends and receives appears here.
          </p>
          <Link href="/hub/organization" className="mt-6 inline-block underline underline-offset-4">
            Find or start an organisation
          </Link>
        </div>
      </SiteShell>
    );
  }

  // Same selection rule as the organization tab, so switching between the two
  // never silently changes which org you are looking at.
  const selected =
    memberships.find((m) => m.orgSlug === orgParam) ??
    memberships.find((m) => m.role === "owner" || m.role === "guide") ??
    memberships[0];

  const guard = await guardOrgEmail(selected.orgSlug);
  if (!guard) redirect("/hub/organization");

  const data = await loadEmailSuite(guard, emailRoutesFor(guard.orgSlug));
  const tab = TABS.has(tabParam as EmailTab) ? (tabParam as EmailTab) : "activity";

  return (
    <SiteShell wide>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="mb-6 border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {guard.orgName}
          </p>
          <h1 className="mt-1 font-serif text-3xl">Email</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everything this organisation sends, everyone it can reach, and the
            replies that come back.
          </p>

          {memberships.length > 1 && (
            <nav className="mt-4 flex flex-wrap gap-2" aria-label="Organisation">
              {memberships.map((m) => (
                <Link
                  key={m.orgId}
                  href={`/email?org=${encodeURIComponent(m.orgSlug)}`}
                  className={`rounded-full border px-3 py-1 text-xs no-underline ${
                    m.orgSlug === guard.orgSlug
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground"
                  }`}
                  aria-current={m.orgSlug === guard.orgSlug ? "page" : undefined}
                >
                  {m.orgName}
                </Link>
              ))}
            </nav>
          )}
        </header>

        {!guard.canEdit && (
          <p className="mb-5 rounded border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            You can read this organisation&rsquo;s email, but only its owners
            and guides can send in its name or change its settings.
          </p>
        )}

        <EmailSuiteHost
          orgSlug={guard.orgSlug}
          data={data}
          canEdit={guard.canEdit}
          tab={tab}
        />
      </div>
    </SiteShell>
  );
}

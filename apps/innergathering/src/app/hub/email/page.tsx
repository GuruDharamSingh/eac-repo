import type { Metadata } from "next";
import type { EmailTab } from "@elkdonis/cms-ui/email";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadEmailSuite } from "@/lib/email-suite";
import { EmailSuiteHost } from "@/components/hub/email/EmailSuiteHost";

export const metadata: Metadata = { title: "Email" };
export const dynamic = "force-dynamic";

const TABS = new Set<EmailTab>(["activity", "inbox", "addresses", "letters", "look"]);

/**
 * The email suite — everything this organisation sends, everyone it can reach,
 * and the replies that come back.
 *
 * REPLACED 2026-09-17. This page used to be a gallery of the nine letters and
 * nothing else: no inbox, no address book, no delivery record, no palette. It
 * is now the shared suite (`@elkdonis/cms-ui/email`), and the old gallery is
 * its Letters tab — previews and both editor links intact.
 *
 * This app is where the suite is FULLY integrated, and the reason is its
 * single tenancy: `/hub/email/<key>`, `/hub/email/<key>/edit` and
 * `/hub/newsletter` are org-implied routes here, so all four links work. The
 * network hub at arts-collective.com/email shows whichever org its switcher
 * selected, and has to thread a slug through every one of those.
 *
 * Editor-only rather than member-visible: these are the words sent in the
 * org's name, and the suite shows the addresses they go to.
 */
export default async function HubEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireOrgEditor("/hub/email");
  const { tab: tabParam } = await searchParams;

  const data = await loadEmailSuite();
  const tab = TABS.has(tabParam as EmailTab) ? (tabParam as EmailTab) : "activity";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 border-b border-border pb-5">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          {siteConfig.orgName}
        </p>
        <h1 className="mt-1 font-serif text-3xl">Email</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every letter sent in this organisation&rsquo;s name, everyone it can
          reach, and the replies that come back.
        </p>
      </header>

      <EmailSuiteHost data={data} canEdit={viewer.canEdit} tab={tab} />
    </div>
  );
}

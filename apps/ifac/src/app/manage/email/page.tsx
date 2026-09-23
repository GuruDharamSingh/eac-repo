import type { Metadata } from "next";
import type { EmailTab } from "@elkdonis/cms-ui/email";
import { requireIfacManager } from "@/lib/manage-auth";
import { loadEmailSuite } from "@/lib/email-suite";
import { siteConfig } from "@/config/site";
import { EmailSuiteHost } from "@/components/hub/email/EmailSuiteHost";

export const metadata: Metadata = { title: "Email — IFAC" };
export const dynamic = "force-dynamic";

const TABS = new Set<EmailTab>(["activity", "inbox", "addresses", "letters", "look"]);

/**
 * Everything the gallery sends, everyone it can reach, and the replies.
 *
 * MOVED here from the hub, 2026-09-19 (owner: "the email can move into the
 * manage area, same with appearance"). It was a card on a members' hub and a
 * page under /hub, and neither is what it is: these are the words sent in
 * IFAC's name, to every address it holds. /hub/email now redirects here, so
 * nothing that was bookmarked breaks. The suite itself is the shared one —
 * what changed is where it hangs.
 */
export default async function ManageEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireIfacManager("/manage/email");
  const { tab: tabParam } = await searchParams;
  const data = await loadEmailSuite();
  const tab = TABS.has(tabParam as EmailTab) ? (tabParam as EmailTab) : "activity";

  return (
    <section className="manage-email">
      <p className="body-copy">
        Sending as <strong>{data.identity.fromEmail}</strong>.
      </p>
      <div className="hub-email-workspace">
        <EmailSuiteHost data={data} canEdit tab={tab} />
      </div>
    </section>
  );
}

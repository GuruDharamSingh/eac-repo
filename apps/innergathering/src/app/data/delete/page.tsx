import type { Metadata } from "next";
import Link from "next/link";
import "@elkdonis/cms-ui/data-policy.css";
import { DeletionRequestForm, DeletionStatus } from "@elkdonis/cms-ui/data-policy";
import { getDeletionRequestByCode } from "@elkdonis/services";
import { CONTACT_EMAIL } from "../page";

export const metadata: Metadata = {
  title: "Deleting your data",
  description: "How to have your account and data removed from the Elkdonis Arts Collective's sites.",
};

/** Reads the database when ?code= names a request. */
export const dynamic = "force-dynamic";

/**
 * Registered with Meta as the app's data deletion instructions URL, and the
 * status page its callback points people to (?code=<confirmation code>).
 */
export default async function DataDeletePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const request = code ? await getDeletionRequestByCode(code).catch(() => null) : null;
  const headingFace = { ["--policy-heading-face" as string]: '"Venture", Georgia, serif' };

  return (
    <div className="ig-page">
      <p className="ig-kicker">Policy</p>
      <h1>Deleting your data</h1>

      {code && !request && (
        <p className="ig-lead" style={{ marginTop: "1.5rem" }}>
          No request matches the code <code>{code}</code>. Check the code, or send a new request below.
        </p>
      )}

      {request ? (
        <div className="ig-prose" style={{ marginTop: "1.5rem", ...headingFace }}>
          <DeletionStatus request={request} contactEmail={CONTACT_EMAIL} />
          <p style={{ marginTop: "2rem" }}>
            <Link className="ig-edit-link" href="/data">← Your data</Link>
          </p>
        </div>
      ) : (
        <div className="ig-prose" style={{ marginTop: "1.5rem", ...headingFace }}>
          <div className="eac-policy">
            <p>
              You can have your account and everything we hold about you removed from this site and from
              the other sites on the network. Three ways:
            </p>
            <ol>
              <li>
                <strong>Use the form below.</strong> Give the email address on the account. You get a
                confirmation code and a page to follow the request.
              </li>
              <li>
                <strong>Email us</strong> at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the
                address on the account.
              </li>
              <li>
                <strong>Ask an organiser</strong> of the group you belong to, in person or in the group&rsquo;s chat.
              </li>
            </ol>
            <p>
              What happens next: an organiser checks that the request comes from the account holder, offers
              a copy of your files and published work, then removes the account, profile, posts, files,
              RSVPs and mailing-list entries. Order records stay for the period tax rules require, without
              your profile. Nightly backups are overwritten on their own schedule, within a year. We answer
              within thirty days.
            </p>
            <p>
              If you connected a Facebook Page, Instagram account or Threads profile to the Studio on arts-collective.com, you
              can also remove the connection there, or remove the app under Facebook&rsquo;s &ldquo;Apps and
              websites&rdquo; settings. Facebook then sends us a deletion request: we delete the stored token
              and account ids at once and record the request under a confirmation code, which the link Facebook
              gives you opens.
            </p>
          </div>
          <DeletionRequestForm />
          <p style={{ marginTop: "2rem" }}>
            <Link className="ig-edit-link" href="/data">← Your data</Link>
          </p>
        </div>
      )}
    </div>
  );
}

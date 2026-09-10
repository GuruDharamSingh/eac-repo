import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { listPendingReviews, type PendingReview } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { ReviewActions } from "@/components/hub/ReviewActions";
import { humanizeAnswerKey, formatAnswer } from "@/lib/answers";

/**
 * Elkdonis vetting queue.
 *
 * Separate from /hub/admin on purpose: that console answers "what exists and
 * what is half-wired" about orgs and domains. This one is about people — what
 * they have told us, and whether it moves them forward in the network. Two
 * different jobs, done at different times, by people in different frames of
 * mind.
 */
export const dynamic = "force-dynamic";

export default async function VettingPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const pending = await listPendingReviews();

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Elkdonis
          </p>
          <h1 className="mt-2 font-serif text-3xl">Vetting queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Workbooks and intake submitted by members, oldest first. Accepting a
            submission can advance someone&apos;s standing in the network;
            returning one sends it back with a note.
          </p>
          <Link
            href="/hub/admin"
            className="mt-3 inline-block text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
          >
            ← Network operations
          </Link>
        </header>

        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Nothing awaiting review.
          </p>
        ) : (
          <ul className="space-y-5">
            {pending.map((r) => (
              <SubmissionCard key={r.id} review={r} />
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}

function SubmissionCard({ review }: { review: PendingReview }) {
  const answers = Object.entries(review.answers);

  return (
    <li className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-xl">{review.questionnaireTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {review.userDisplayName || review.userEmail}
            {review.orgName ? ` · for ${review.orgName}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {review.submittedAt
            ? new Date(review.submittedAt).toLocaleDateString()
            : "—"}
        </div>
      </div>

      {answers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Submitted with no answers recorded.
        </p>
      ) : (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {answers.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {humanizeAnswerKey(key)}
              </dt>
              <dd className="mt-0.5 break-words text-sm text-foreground">
                {formatAnswer(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ReviewActions responseId={review.id} />
    </li>
  );
}


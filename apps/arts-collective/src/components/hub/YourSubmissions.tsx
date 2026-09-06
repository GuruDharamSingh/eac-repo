import { listResponsesForUser } from "@elkdonis/services";
import {
  humanizeAnswerKey,
  formatAnswer,
  RESPONSE_STATUS_LABEL,
} from "@/lib/answers";

/**
 * What this member has told Elkdonis, read back to them.
 *
 * The hub cards above say whether a wizard is complete; they never showed what
 * was actually written. People have been filling in substantial workbooks —
 * goals, needs, how their collective governs itself — that nothing, including
 * the author, could read back. This is that surface.
 *
 * Reviewed submissions stay listed rather than disappearing: what you said
 * last year is worth seeing beside what you say now.
 */
export async function YourSubmissions({ userId }: { userId: string }) {
  const responses = await listResponsesForUser(userId);
  if (responses.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl">What you&apos;ve told us</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your answers, and where each one stands with the collective.
      </p>

      <ul className="mt-6 space-y-4">
        {responses.map((r) => {
          const answers = Object.entries(r.answers);
          return (
            <li key={r.id} className="rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-foreground">
                  {r.questionnaireTitle}
                  {r.orgName ? (
                    <span className="text-muted-foreground"> · {r.orgName}</span>
                  ) : null}
                </h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {RESPONSE_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>

              {r.status === "returned" && r.reviewNote && (
                <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <span className="font-medium">From the collective:</span>{" "}
                  {r.reviewNote}
                </p>
              )}

              {answers.length > 0 && (
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}

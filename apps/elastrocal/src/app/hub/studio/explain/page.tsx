import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getExplainQuestion, INTERPRETATION_MAX, listInterpretations } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { ExplainThinkingForm } from "@/components/studio/explain-thinking-form";

export const metadata: Metadata = { title: "Explain my thinking · Studio" };
export const dynamic = "force-dynamic";

/**
 * "Explain my thinking" on a deck question: the owner writes his own answer
 * or what he thinks would happen; it becomes an interpretation with no chart
 * (the question's factors instead), and the worker proposes chains of
 * reasoning and pulls up the passages it looked at, which he then marks on
 * /hub/studio/interpret/[id]. Test-set questions are answered blind and are
 * not offered here.
 */
export default async function ExplainPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireStudioReviewer(sp.q ? `/hub/studio/explain?q=${sp.q}` : "/hub/studio/deck");
  if (!sp.q) notFound();
  const question = await getExplainQuestion(sp.q);
  if (!question) notFound();
  const earlier = question.isTest ? [] : await listInterpretations(viewer.userId, { questionId: question.id });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio/deck" className="text-sm text-muted-foreground hover:text-primary">
          ← Deck
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Explain my thinking</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {question.factorLabels.map((l) => (
          <span key={l} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
            {l}
          </span>
        ))}
      </div>
      {/* Inline face: globals.css sets h1 to Cinzel (capitals only) outside any layer. */}
      <h1 className="mt-3 text-xl font-semibold leading-snug" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", letterSpacing: "normal" }}>
        {question.prompt}
      </h1>
      {question.factorKeys.length > 0 && <p className="mt-1 break-words text-[11px] text-muted-foreground">{question.factorKeys.join(" · ")}</p>}

      {question.isTest ? (
        <div className="mt-6 rounded-2xl border border-gold/60 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Test question.</span> It is answered blind in the deck and kept out of training, so it can&apos;t be
          explained here.
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <p className="font-medium">What happens</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Write your answer, or what you think would happen, in your own words.</li>
              <li>
                The AI reads it, searches the library&apos;s books for what could lie behind it, and writes a few guesses at your reasoning, step by
                step (usually under a minute).
              </li>
              <li>
                You judge each guess (right, partly, wrong), then mark which book passages were really part of your thinking. That teaches it how
                you reason and what to look for.
              </li>
            </ol>
          </div>
          <ExplainThinkingForm questionId={question.id} maxLength={INTERPRETATION_MAX} />
        </>
      )}

      {earlier.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your earlier explanations</h2>
          <ul className="mt-3 space-y-2">
            {earlier.map((it) => (
              <li key={it.id}>
                <Link href={`/hub/studio/interpret/${it.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/60">
                  <p className="text-muted-foreground">{it.excerpt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(it.createdAt).toLocaleDateString()} · {it.status}
                    {it.chains ? ` · ${it.chains} chain${it.chains === 1 ? "" : "s"}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

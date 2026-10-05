import Link from "next/link";
import type { Metadata } from "next";
import { claimStats, foundationsReady, listFoundationLessons, listInterpretations, studioStats, vocabProgress, vocabReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  planet: "Planets alone",
  zodiac: "Signs alone",
  realm: "Areas of life",
  "aspect-type": "Aspects alone",
  sign: "Signs",
  house: "Houses",
  aspect: "Aspects",
  transit: "Transits to natal points",
  "transit-house": "Transits through houses",
  "transit-sign": "Transits through signs",
  compat: "Compatibility",
  general: "General",
};

/**
 * The studio's front page: what is waiting, what has been done, and how much
 * of the factor registry has a gold text. Design and phases:
 * docs/open/ASTRO_STUDIO_BRIEF_2026-09-26.md.
 */
export default async function StudioPage() {
  const viewer = await requireStudioReviewer("/hub/studio");
  const [stats, claims, vocab, interpretations, lessons] = await Promise.all([
    studioStats(viewer.userId),
    claimStats(viewer.userId),
    vocabReady().then((ok) => (ok ? vocabProgress(viewer.userId) : null)),
    listInterpretations(viewer.userId),
    foundationsReady().then((ok) => (ok ? listFoundationLessons(viewer.userId) : [])),
  ]);
  const recent = interpretations.slice(0, 3);
  const done = stats.mine.reduce((n, a) => n + a.n, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">{siteConfig.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold">Studio</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Grade, correct and write interpretations. Every answer here becomes training and test data for an astrologer AI.
      </p>

      <Link
        href="/hub/studio/foundations"
        className="mt-6 flex items-center justify-between rounded-2xl border-2 border-gold bg-gold/10 px-6 py-5 shadow-sm hover:bg-gold/20"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-gold">Start here</span>
          <span className="block text-lg font-semibold">Foundations: the basics, one idea at a time</span>
          <span className="block text-sm text-muted-foreground">
            {lessons.length > 0
              ? lessons.map((l) => `${l.title}: ${l.reviewed.toLocaleString()} / ${l.total.toLocaleString()} reviewed`).join(" · ")
              : "Check what the books say about each basic idea. What you confirm becomes the rulebook."}
          </span>
        </span>
        <span className="text-2xl text-gold" aria-hidden>
          →
        </span>
      </Link>

      <Link
        href="/hub/studio/library"
        className="mt-3 flex items-center justify-between rounded-2xl border-2 border-gold px-6 py-4 hover:bg-gold/10"
      >
        <span>
          <span className="block text-lg font-semibold">Library: see what we have so far</span>
          <span className="block text-sm text-muted-foreground">
            Every subject (elements, signs, planets, houses, aspects, planet in sign) with its keywords, passages and the books they come from.
          </span>
        </span>
        <span className="text-2xl text-gold" aria-hidden>
          →
        </span>
      </Link>

      <Link
        href="/hub/studio/deck"
        className="mt-3 flex items-center justify-between rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-sm"
      >
        <span>
          <span className="block text-lg font-semibold">Judge AI answers</span>
          <span className="block text-sm opacity-80">
            {stats.drafted.waiting > 0
              ? `${stats.drafted.waiting.toLocaleString()} questions with AI drafts waiting`
              : "No AI drafts waiting · the deck serves the other questions"}
            {" "}· {stats.today} reviewed in the last day
          </span>
        </span>
        <span className="text-2xl" aria-hidden>
          →
        </span>
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">
        Pick the better draft, rate it, or fix it into the answer you would give. On any question, “Explain my thinking” lets you write what you
        think and see the reasoning and passages the AI connects to it.
      </p>

      {vocab && vocab.all.total > 0 && (
        <Link
          href="/hub/studio/vocabulary"
          className="mt-3 flex items-center justify-between rounded-2xl border border-primary/60 px-6 py-4 hover:bg-primary/5"
        >
          <span>
            <span className="block font-semibold">Sort the vocabulary</span>
            <span className="block text-sm text-muted-foreground">
              Put the terms the books use into your own groups: they become the concept kinds and the thesaurus ·{" "}
              {vocab.deck.total > 0
                ? `${vocab.deck.sorted} / ${vocab.deck.total} of the first deck`
                : `${vocab.all.sorted.toLocaleString()} / ${vocab.all.total.toLocaleString()} sorted`}
            </span>
          </span>
          <span className="text-xl text-primary" aria-hidden>
            →
          </span>
        </Link>
      )}

      <Link
        href="/hub/studio/claims"
        className="mt-3 flex items-center justify-between rounded-2xl border border-primary/60 px-6 py-4 hover:bg-primary/5"
      >
        <span>
          <span className="block font-semibold">Check AI claims</span>
          <span className="block text-sm text-muted-foreground">
            The AI's first reading of each book passage, next to the passage: {claims.touchingMine.toLocaleString()} passages touch your charts ·{" "}
            {claims.checked.toLocaleString()} of {claims.passages.toLocaleString()} checked
          </span>
        </span>
        <span className="text-xl text-primary" aria-hidden>
          →
        </span>
      </Link>

      <div className="mt-3 rounded-2xl border border-primary/60 px-6 py-4">
        <Link href="/hub/studio/interpret" className="flex items-center justify-between gap-3 hover:text-primary">
          <span>
            <span className="block font-semibold">Explain my thinking</span>
            <span className="block text-sm text-muted-foreground">
              Write your answer to a deck question (“Explain my thinking →” on any card) or your reading of a chart. The AI guesses the reasoning
              behind it and shows the book passages it drew on; you mark what was really yours.
            </span>
          </span>
          <span className="text-xl text-primary" aria-hidden>
            →
          </span>
        </Link>
        {recent.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
            {recent.map((it) => (
              <li key={it.id}>
                <Link href={`/hub/studio/interpret/${it.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-primary">
                  <span className="min-w-0 truncate">{it.questionPrompt ?? it.chartName ?? it.excerpt}</span>
                  <span
                    className={
                      it.status === "ready"
                        ? "shrink-0 text-xs text-primary"
                        : it.status === "failed"
                          ? "shrink-0 text-xs text-destructive"
                          : "shrink-0 text-xs text-muted-foreground"
                    }
                  >
                    {it.status === "ready"
                      ? `${it.chains} guess${it.chains === 1 ? "" : "es"} ready`
                      : it.status === "failed"
                        ? "failed"
                        : it.status === "running"
                          ? "AI working…"
                          : "waiting"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stats.test.total > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Test set</span>
            <span className="tabular-nums text-muted-foreground">
              {stats.test.answered} of {stats.test.total} answered
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.round((100 * stats.test.answered) / stats.test.total)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            These questions are answered blind: no AI drafts and no earlier answers are shown, because seeing one first would pull your answer
            towards it. Your answers become the independent standard the AI is scored against, and are never used for training.
          </p>
          {stats.test.answered < stats.test.total && (
            <Link href="/hub/studio/deck?mode=test" className="mt-3 inline-block text-sm font-medium text-primary">
              Answer the test set (blind) →
            </Link>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {stats.byOrigin.map((o) => `${o.open.toLocaleString()} ${o.origin === "curated" ? "curated" : o.origin === "import" ? "imported" : o.origin}`).join(" · ")}
        {" "}open in all · after the AI drafts, the deck draws curated questions three times for every imported one.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Waiting, by kind</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {stats.queue.map((q) => (
            <li key={q.kind}>
              <Link
                href={`/hub/studio/deck?kind=${q.kind}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/60"
              >
                <span>{KIND_LABEL[q.kind] ?? q.kind}</span>
                <span className="tabular-nums text-muted-foreground">{q.open.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your reviews</h2>
        {done === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {stats.mine.map((a) => (
              <li key={a.action} className="rounded-full border border-border px-3 py-1">
                {a.action} <span className="tabular-nums text-muted-foreground">{a.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Coverage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Factors with at least one text written or corrected in the studio, out of all possible factors of that kind.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Kind</th>
              <th className="py-1 text-right font-normal">Gold</th>
              <th className="py-1 text-right font-normal">Asked</th>
              <th className="py-1 text-right font-normal">Factors</th>
            </tr>
          </thead>
          <tbody>
            {stats.coverage.map((c) => (
              <tr key={c.kind} className="border-t border-border/60">
                <td className="py-2">{KIND_LABEL[c.kind] ?? c.kind}</td>
                <td className="py-2 text-right tabular-nums">{c.with_gold}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{c.with_question}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{c.factors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sources</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {stats.sources.map((s) => (
            <li key={s.title} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{s.title}</span>
                <span className="tabular-nums text-muted-foreground">{s.texts.toLocaleString()} texts</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.kind} · licence {s.licence} · {s.trainable ? "cleared for training" : "not cleared for training"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

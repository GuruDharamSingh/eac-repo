"use client";

import { useMemo, useState } from "react";
import type { ChartResult } from "@elkdonis/astro";
import { ask, readChart, type AspectReading, type PlacementReading, type Step } from "@elkdonis/astro/keywords";
import { cn } from "@/lib/utils";

/**
 * The Rosicrucian keyword reading of a chart.
 *
 * Computed here on the client from the chart the page already holds — the
 * keyword engine is pure TypeScript and a reading is a few milliseconds —
 * so there is nothing to fetch and nothing to store. Three layers:
 *
 *   the key        what the chart as a whole is about (step 11 first)
 *   the composite  character and circumstances in everyday words
 *   each aspect    its summary, and under it the book's ten steps
 *
 * plus a question box, which retrieves from the sentences above rather than
 * inventing anything: every line of an answer names the aspect it came from.
 */
export function ReadingPanel({ chart, name, className }: { chart: ChartResult; name?: string; className?: string }) {
  const reading = useMemo(() => readChart(chart), [chart]);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const answer = useMemo(() => (asked ? ask(reading, asked) : null), [reading, asked]);

  return (
    <section className={cn("rounded-xl border border-border bg-card/80 p-5", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Reading</h3>
        <span className="text-xs text-muted-foreground">
          The Rosicrucian keyword method · {reading.aspects.length} aspects, {reading.placements.length} unaspected
        </span>
      </div>

      <div className="space-y-5 text-sm leading-relaxed">
        <Block title="Key to the chart">
          <p>{reading.key.summary}</p>
        </Block>

        <Block title="Character">
          <p>{reading.character}</p>
        </Block>

        <Block title="Circumstances">
          <p>{reading.circumstances}</p>
        </Block>

        {reading.tensions.length > 0 && (
          <Block title="Where the chart speaks both ways">
            <ul className="space-y-2">
              {reading.tensions.map((t) => (
                <li key={t.domain}>
                  <span className="font-medium capitalize">{t.domain}.</span> {t.well} <span className="text-muted-foreground">But:</span> {t.badly}
                </li>
              ))}
            </ul>
          </Block>
        )}

        <Block title={`Ask ${name ? `${name}’s` : "the"} chart`}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setAsked(question.trim());
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What about my work? Who am I? Tell me about my Saturn…"
              className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ask
            </button>
          </form>
          {answer && (
            <div className="mt-3 space-y-2">
              <p className="whitespace-pre-line">{answer.text}</p>
              {answer.sources.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Where this comes from</summary>
                  <ul className="mt-1 space-y-1">
                    {answer.sources.map((s, i) => (
                      <li key={i}>
                        <span className="text-foreground">{s.source}</span> — {s.learn}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {answer.topics.length > 0 && (
                <p className="text-xs text-muted-foreground">Read as a question about {answer.topics.join(", ")}.</p>
              )}
            </div>
          )}
        </Block>

        <Block title="The aspects, strongest first">
          <ul className="space-y-2">
            {reading.aspects.map((a) => (
              <AspectItem key={a.label} reading={a} />
            ))}
          </ul>
        </Block>

        {reading.placements.length > 0 && (
          <Block title="Unaspected planets">
            <p className="mb-2 text-xs text-muted-foreground">
              With no major aspect the book gives no rule for choosing the positive or negative set, so these are read from their basic keywords only.
            </p>
            <ul className="space-y-2">
              {reading.placements.map((p) => (
                <PlacementItem key={p.label} reading={p} />
              ))}
            </ul>
          </Block>
        )}
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function NatureBadge({ nature, mixed }: { nature: "harmonious" | "inharmonious"; mixed: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        nature === "harmonious" ? "border-water/50 text-water" : "border-fire/50 text-fire",
      )}
    >
      {mixed ? "mixed" : nature}
    </span>
  );
}

function AspectItem({ reading }: { reading: AspectReading }) {
  return (
    <li className="rounded-lg border border-border/60 bg-card px-3 py-2">
      <details>
        <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2">
          <span className="font-medium">{reading.label}</span>
          <NatureBadge nature={reading.nature.nature} mixed={reading.nature.mixed} />
          {!reading.nature.inSystem && <span className="text-[10px] text-muted-foreground">outside the book’s system</span>}
        </summary>
        <div className="mt-2 space-y-2">
          <p>{reading.character}</p>
          <p>{reading.circumstances}</p>
          <details className="text-xs">
            <summary className="cursor-pointer select-none text-muted-foreground">The ten steps, with the keywords attributed</summary>
            <ol className="mt-2 space-y-2">
              {reading.steps.map((s) => (
                <StepItem key={s.n} step={s} />
              ))}
            </ol>
            {reading.abbreviated.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">The abbreviated method</div>
                <ul className="space-y-1">
                  {reading.abbreviated.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        </div>
      </details>
    </li>
  );
}

function StepItem({ step }: { step: Step }) {
  return (
    <li>
      <div className="font-medium text-foreground">
        {step.n}. {step.title}
      </div>
      <div className="text-muted-foreground italic">{step.instruction}</div>
      {step.note && <p className="mt-1 whitespace-pre-line">{step.note}</p>}
      {step.units.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {step.units.map((u, i) => (
            <li key={i}>{u.learn}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PlacementItem({ reading }: { reading: PlacementReading }) {
  return (
    <li className="rounded-lg border border-border/60 bg-card px-3 py-2">
      <details>
        <summary className="cursor-pointer select-none font-medium">{reading.label}</summary>
        <div className="mt-2 space-y-1">
          <p>{reading.character.map((u) => u.plain).join(" ")}</p>
          <p>{reading.circumstances.map((u) => u.plain).join(" ")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {reading.units.map((u, i) => (
              <li key={i}>{u.learn}</li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}

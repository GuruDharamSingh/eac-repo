"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InterpretationDetail, InterpretationReference, ReasoningChain, ReasoningStep } from "@elkdonis/astro-corpus/server";
import { reasoningReviewAction, requeueInterpretationAction, type ReasoningReviewInput } from "@/app/hub/studio/interpret/actions";
import { cn } from "@/lib/utils";

/**
 * One interpretation and the chains of reasoning proposed for it, laid out
 * for a phone.
 *
 * Tap a sentence to see which chains explain it. In a chain, each step shows
 * "because of steps N, M" (its based_on): tap it to light up the steps it
 * rests on, so any conclusion can be traced back to the chart factors and
 * passages behind it. Cite steps open to the passage. Every step and chain
 * takes a verdict and an optional comment; "Closest to my reasoning" picks a
 * chain; "Add the step you actually used" records what the chains missed.
 * "Examples the AI looked at" lists every passage the worker retrieved (not
 * only those cited): mark each as part of your thinking, related, or not it.
 * While the worker is generating, the page refreshes itself every 4 seconds
 * and says how long it has been waiting. A ready page opens with a one-line
 * summary that links down to the examples.
 */

const REFRESH_MS = 4_000;

const KIND_LABEL: Record<string, string> = { observe: "observe", cite: "cite", infer: "infer", conclude: "conclude" };
const KIND_STYLE: Record<string, string> = {
  observe: "border-primary/40 text-primary",
  cite: "border-gold/60 text-gold",
  infer: "border-border text-foreground",
  conclude: "border-primary bg-primary text-primary-foreground",
};
const VERDICT_LABEL: Record<string, string> = {
  right: "Right",
  partly: "Partly",
  wrong: "Wrong",
  "wrong-reference": "Wrong reference",
  irrelevant: "Irrelevant",
  plausible: "Plausible",
  implausible: "Implausible",
  mine: "Part of my thinking",
  related: "Related",
  not: "Not it",
};

type Payload = Record<string, unknown>;

function latestBy(reviews: InterpretationDetail["reviews"], action: string, key: string): Map<string, Payload> {
  const out = new Map<string, Payload>();
  for (const r of reviews) {
    if (r.action !== action) continue;
    const id = r.payload[key];
    if (typeof id === "string") out.set(id, r.payload);
  }
  return out;
}

export function ReasoningExplorer({
  detail,
  chainVerdicts,
  stepVerdicts,
  stepKinds,
  refVerdicts,
  textMax,
}: {
  detail: InterpretationDetail;
  chainVerdicts: string[];
  stepVerdicts: string[];
  stepKinds: string[];
  refVerdicts: string[];
  textMax: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sentence, setSentence] = useState<number | null>(null);
  const opened = useRef(performance.now());

  const working = detail.status === "queued" || detail.status === "running";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [working, router]);

  const stepVerdict = useMemo(() => latestBy(detail.reviews, "step-verdict", "stepId"), [detail.reviews]);
  const chainVerdict = useMemo(() => latestBy(detail.reviews, "chain-verdict", "chainId"), [detail.reviews]);
  const pickedChain = useMemo(() => {
    const picks = detail.reviews.filter((r) => r.action === "chain-pick");
    const last = picks[picks.length - 1];
    return typeof last?.payload.chainId === "string" ? last.payload.chainId : null;
  }, [detail.reviews]);
  const addedSteps = useMemo(() => detail.reviews.filter((r) => r.action === "step-add"), [detail.reviews]);
  // Latest mark per passage (this page only shows the viewer's own interpretation and reviews).
  const refMark = useMemo(() => {
    const out = new Map<string, Payload>();
    for (const r of detail.reviews) {
      if (r.action !== "ref-mark" || typeof r.payload.chunkId !== "string") continue;
      const ord = typeof r.payload.statementOrdinal === "number" ? r.payload.statementOrdinal : "";
      out.set(`${r.payload.chunkId}#${ord}`, r.payload);
    }
    return out;
  }, [detail.reviews]);

  const save = (action: ReasoningReviewInput["action"], payload: Payload, done?: () => void) =>
    startTransition(async () => {
      const r = await reasoningReviewAction({
        action,
        payload: { interpretationId: detail.id, ...payload },
        seconds: Math.round((performance.now() - opened.current) / 1000),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      done?.();
      router.refresh();
    });

  const requeue = () =>
    startTransition(async () => {
      const r = await requeueInterpretationAction(detail.id);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const chainsFor = (i: number) => detail.chains.filter((c) => c.sentences.includes(i)).length;
  const cited = detail.references.filter((r) => r.citedBy.length > 0).length;
  const marked = new Set(detail.reviews.filter((r) => r.action === "ref-mark").map((r) => `${String(r.payload.chunkId)}#${typeof r.payload.statementOrdinal === "number" ? r.payload.statementOrdinal : ""}`)).size;
  // Seconds since the job was queued or last picked up. Read on the client after
  // each refresh (not during render, so server and client markup agree).
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!working) return;
    const tick = () => setWaited(Math.max(0, Math.round((Date.now() - new Date(detail.updatedAt).getTime()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [working, detail.updatedAt]);

  return (
    <div className="mt-4">
      {detail.question ? (
        <>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deck question</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", letterSpacing: "normal" }}>
            {detail.question.prompt}
          </h1>
          {detail.question.factorLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.question.factorLabels.map((l) => (
                <span key={l} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
                  {l}
                </span>
              ))}
            </div>
          )}
          <Link href="/hub/studio/deck" className="mt-2 inline-block text-xs text-primary">
            Back to the deck
          </Link>
        </>
      ) : (
        <h1 className="text-xl font-semibold">{detail.chartName ?? "Interpretation"}</h1>
      )}

      {working && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-card px-4 py-3 text-sm" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-medium">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
            {detail.status === "queued" ? "Waiting for the AI to pick this up…" : "The AI is working on it…"}
          </p>
          <p className="mt-1 text-muted-foreground">
            It reads your {detail.question ? "answer" : "interpretation"} and searches the library&apos;s books for what could lie behind it, then
            writes a few guesses at your reasoning. Usually under a minute; this page updates by itself
            {waited >= 5 ? ` (${waited < 120 ? `${waited} s` : `${Math.round(waited / 60)} min`} so far)` : ""}.
          </p>
          {detail.status === "queued" && waited > 300 && (
            <p className="mt-1 text-xs text-muted-foreground">Still queued after five minutes: the worker on the pipeline machine may not be running.</p>
          )}
          {detail.chains.length > 0 && <p className="mt-1 text-xs text-muted-foreground">New guesses are added below the ones already here.</p>}
        </div>
      )}
      {detail.status === "ready" && detail.chains.length > 0 && (
        <div className="mt-3 rounded-xl border border-primary/50 bg-primary/5 px-4 py-3 text-sm">
          <p>
            <span className="font-medium">
              {detail.chains.length} guess{detail.chains.length === 1 ? "" : "es"} at your reasoning
            </span>
            {detail.references.length > 0 && (
              <>
                , drawing on {detail.references.length} passage{detail.references.length === 1 ? "" : "s"} from the books
                {cited > 0 ? ` (${cited} cited)` : ""}
              </>
            )}
            .
          </p>
          <p className="mt-1 text-muted-foreground">
            Judge each guess step by step below
            {detail.references.length > 0 && (
              <>
                , then{" "}
                <a href="#examples" className="font-medium text-primary underline-offset-2 hover:underline">
                  mark the examples ↓
                </a>{" "}
                that were really part of your thinking{marked > 0 ? ` (${marked} of ${detail.references.length} marked)` : ""}
              </>
            )}
            .
          </p>
        </div>
      )}
      {detail.status === "failed" && (
        <div className="mt-3 rounded-xl border border-destructive/60 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">The worker could not generate chains.</p>
          {detail.error && <p className="mt-1 text-muted-foreground">{detail.error}</p>}
          <button type="button" onClick={requeue} disabled={pending} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs">
            Try again
          </button>
        </div>
      )}

      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{detail.question ? "Your answer" : "Your interpretation"}</h2>
        <p className="mt-2 leading-relaxed">
          {detail.sentences.map((s, i) => {
            const n = chainsFor(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSentence(sentence === i ? null : i)}
                className={cn(
                  "mr-1 rounded px-0.5 text-left transition-colors",
                  sentence === i ? "bg-primary/15 ring-1 ring-primary" : n ? "hover:bg-muted" : "text-muted-foreground",
                )}
                title={n ? `${n} chain${n === 1 ? "" : "s"} explain this` : "No chain explains this yet"}
              >
                {s}
                {n > 0 && <sup className="ml-0.5 text-[10px] text-primary">{n}</sup>}
              </button>
            );
          })}
        </p>
        {sentence !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the chains that explain sentence {sentence + 1}.{" "}
            <button type="button" className="text-primary" onClick={() => setSentence(null)}>
              Show all
            </button>
          </p>
        )}
      </section>

      <section className="mt-6 space-y-4">
        {detail.chains.length === 0 && !working && <p className="text-sm text-muted-foreground">No chains yet.</p>}
        {detail.chains.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            sentences={detail.sentences}
            dimmed={sentence !== null && !chain.sentences.includes(sentence)}
            onSentence={setSentence}
            picked={pickedChain === chain.id}
            verdict={chainVerdict.get(chain.id) ?? null}
            stepVerdict={stepVerdict}
            added={addedSteps.filter((r) => r.payload.chainId === chain.id)}
            chainVerdicts={chainVerdicts}
            stepVerdicts={stepVerdicts}
            stepKinds={stepKinds}
            textMax={textMax}
            pending={pending}
            save={save}
          />
        ))}
      </section>

      {detail.references.length > 0 && (
        <section id="examples" className="mt-8 scroll-mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Examples the AI looked at</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every passage it retrieved for this, cited or not. Mark the ones that went into your thinking; the marks teach it what to look for.
          </p>
          <ul className="mt-3 space-y-3">
            {detail.references.map((ref) => (
              <ReferenceItem
                key={ref.key}
                reference={ref}
                mark={refMark.get(ref.key) ?? null}
                verdicts={refVerdicts}
                textMax={textMax}
                pending={pending}
                onMark={(verdict, note, done) =>
                  save("ref-mark", { chunkId: ref.chunkId, statementOrdinal: ref.statementOrdinal, verdict, note }, done)
                }
              />
            ))}
          </ul>
        </section>
      )}

      {!working && (
        <button
          type="button"
          onClick={requeue}
          disabled={pending}
          className="mt-6 w-full rounded-xl border border-border px-4 py-3 text-sm font-medium hover:border-primary/60 disabled:opacity-50"
        >
          Generate more chains
        </button>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        {detail.question ? "Question factors" : "Chart factors"}: {detail.factorKeys.length} · submitted {new Date(detail.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function Chips({
  options,
  value,
  disabled,
  onChoose,
}: {
  options: string[];
  value: string | null;
  disabled: boolean;
  onChoose: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(o)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            value === o ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/60",
          )}
        >
          {VERDICT_LABEL[o] ?? o}
        </button>
      ))}
    </div>
  );
}

/** Verdict chips plus an optional comment saved with the chosen verdict. */
function Judge({
  options,
  current,
  pending,
  textMax,
  onSave,
}: {
  options: string[];
  current: Payload | null;
  pending: boolean;
  textMax: number;
  onSave: (verdict: string, comment: string | undefined, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const verdict = typeof current?.verdict === "string" ? current.verdict : null;
  const savedComment = typeof current?.comment === "string" ? current.comment : null;
  return (
    <div className="mt-2">
      <Chips options={options} value={verdict} disabled={pending} onChoose={(v) => onSave(v, comment.trim() || undefined, () => setComment(""))} />
      {savedComment && <p className="mt-1 text-xs italic text-muted-foreground">“{savedComment}”</p>}
      {open ? (
        <div className="mt-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={textMax}
            placeholder="Why? (saved with the verdict)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={pending || !verdict || !comment.trim()}
              onClick={() => verdict && onSave(verdict, comment.trim(), () => setComment(""))}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              Save with “{verdict ? VERDICT_LABEL[verdict] ?? verdict : "…"}”
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">
              Close
            </button>
          </div>
          {!verdict && <p className="mt-1 text-xs text-muted-foreground">Choose a verdict, or tap one to save it with this comment.</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-xs text-primary">
          Comment
        </button>
      )}
    </div>
  );
}

function ChainCard({
  chain,
  sentences,
  dimmed,
  onSentence,
  picked,
  verdict,
  stepVerdict,
  added,
  chainVerdicts,
  stepVerdicts,
  stepKinds,
  textMax,
  pending,
  save,
}: {
  chain: ReasoningChain;
  sentences: string[];
  dimmed: boolean;
  onSentence: (i: number) => void;
  picked: boolean;
  verdict: Payload | null;
  stepVerdict: Map<string, Payload>;
  added: InterpretationDetail["reviews"];
  chainVerdicts: string[];
  stepVerdicts: string[];
  stepKinds: string[];
  textMax: number;
  pending: boolean;
  save: (action: ReasoningReviewInput["action"], payload: Payload, done?: () => void) => void;
}) {
  const [lit, setLit] = useState<number[]>([]);
  const byOrdinal = new Map(chain.steps.map((s) => [s.ordinal, s]));

  const trace = (ordinals: number[]) => {
    setLit(ordinals);
    const first = ordinals[0];
    if (first !== undefined) document.getElementById(`step-${chain.id}-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <article className={cn("rounded-2xl border bg-card p-4 transition-opacity", picked ? "border-primary" : "border-border", dimmed && "opacity-50")}>
      <header>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Chain {chain.ordinal}</span>
          {picked && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">closest to yours</span>}
        </div>
        <p className="mt-1 font-medium">{chain.summary}</p>
        {chain.sentences.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Explains{" "}
            {chain.sentences.map((i, k) => (
              <span key={i}>
                {k > 0 && ", "}
                <button type="button" className="text-primary" onClick={() => onSentence(i)} title={sentences[i]}>
                  sentence {i + 1}
                </button>
              </span>
            ))}
          </p>
        )}
      </header>

      <ol className="mt-3 space-y-3">
        {chain.steps.map((step) => (
          <StepItem
            key={step.id}
            chainId={chain.id}
            step={step}
            lit={lit.includes(step.ordinal)}
            byOrdinal={byOrdinal}
            onTrace={trace}
            verdict={stepVerdict.get(step.id) ?? null}
            stepVerdicts={stepVerdicts}
            textMax={textMax}
            pending={pending}
            onVerdict={(v, comment, done) => save("step-verdict", { chainId: chain.id, stepId: step.id, verdict: v, comment }, done)}
          />
        ))}
      </ol>

      {added.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-primary/50 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-primary">Steps you added</p>
          <ul className="mt-1 space-y-1 text-sm">
            {added.map((r) => {
              const after = chain.steps.find((s) => s.id === r.payload.afterStepId);
              return (
                <li key={r.id}>
                  <span className="text-xs text-muted-foreground">{after ? `after step ${after.ordinal} · ` : ""}{String(r.payload.kind)} · </span>
                  {String(r.payload.body)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">Is this chain a plausible route to what you wrote?</p>
        <Judge
          options={chainVerdicts}
          current={verdict}
          pending={pending}
          textMax={textMax}
          onSave={(v, comment, done) => save("chain-verdict", { chainId: chain.id, verdict: v, comment }, done)}
        />
        <button
          type="button"
          disabled={pending || picked}
          onClick={() => save("chain-pick", { chainId: chain.id })}
          className={cn(
            "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium",
            picked ? "bg-primary/15 text-primary" : "border border-primary text-primary hover:bg-primary/10",
          )}
        >
          {picked ? "✓ Closest to my reasoning" : "Closest to my reasoning"}
        </button>
        <AddStep chain={chain} stepKinds={stepKinds} textMax={textMax} pending={pending} save={save} />
      </div>
    </article>
  );
}

function StepItem({
  chainId,
  step,
  lit,
  byOrdinal,
  onTrace,
  verdict,
  stepVerdicts,
  textMax,
  pending,
  onVerdict,
}: {
  chainId: string;
  step: ReasoningStep;
  lit: boolean;
  byOrdinal: Map<number, ReasoningStep>;
  onTrace: (ordinals: number[]) => void;
  verdict: Payload | null;
  stepVerdicts: string[];
  textMax: number;
  pending: boolean;
  onVerdict: (verdict: string, comment: string | undefined, done: () => void) => void;
}) {
  const basis = step.basedOn.filter((n) => byOrdinal.has(n));
  const src = step.source;
  return (
    <li id={`step-${chainId}-${step.ordinal}`} className={cn("rounded-xl border p-3 transition-shadow", lit ? "border-primary ring-2 ring-primary/40" : "border-border/70")}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{step.ordinal}</span>
        <div className="min-w-0 flex-1">
          <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide", KIND_STYLE[step.kind] ?? "border-border")}>
            {KIND_LABEL[step.kind] ?? step.kind}
          </span>
          <p className="mt-1 text-sm leading-relaxed">{step.body}</p>

          {basis.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              because of{" "}
              {basis.map((n, k) => (
                <span key={n}>
                  {k > 0 && (k === basis.length - 1 ? " and " : ", ")}
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => onTrace(basis)} title={byOrdinal.get(n)?.body}>
                    step {n}
                  </button>
                </span>
              ))}
            </p>
          )}

          {step.factorKeys.length > 0 && <p className="mt-1 break-words text-[11px] text-muted-foreground">{step.factorKeys.join(" · ")}</p>}

          {step.kind === "cite" && src && (
            <details className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {[src.book, src.author].filter(Boolean).join(" — ") || "Passage"}
                {src.pages.length > 0 && ` · p. ${src.pages.length > 1 ? `${src.pages[0]}–${src.pages[src.pages.length - 1]}` : src.pages[0]}`}
              </summary>
              {src.statement && <p className="mt-2 font-medium">“{src.statement}”</p>}
              {src.headings.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{src.headings.join(" › ")}</p>}
              {src.excerpt && <p className="mt-2 whitespace-pre-line text-muted-foreground">{src.excerpt}</p>}
              {src.statementFactors.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{src.statementFactors.join(" · ")}</p>}
            </details>
          )}

          <Judge options={stepVerdicts} current={verdict} pending={pending} textMax={textMax} onSave={onVerdict} />
        </div>
      </div>
    </li>
  );
}

function AddStep({
  chain,
  stepKinds,
  textMax,
  pending,
  save,
}: {
  chain: ReasoningChain;
  stepKinds: string[];
  textMax: number;
  pending: boolean;
  save: (action: ReasoningReviewInput["action"], payload: Payload, done?: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [after, setAfter] = useState<string>("");
  const [kind, setKind] = useState(stepKinds[0] ?? "observe");
  const [body, setBody] = useState("");
  const [comment, setComment] = useState("");

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 w-full text-center text-xs text-primary">
        + Add the step you actually used
      </button>
    );

  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={after} onChange={(e) => setAfter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">At the end</option>
          {chain.steps.map((s) => (
            <option key={s.id} value={s.id}>
              After step {s.ordinal}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
          {stepKinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k] ?? k}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={textMax}
        placeholder="The step, as you would put it"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={textMax}
        placeholder="Comment (optional)"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={() =>
            save(
              "step-add",
              { chainId: chain.id, afterStepId: after || undefined, kind, body: body.trim(), comment: comment.trim() || undefined },
              () => {
                setBody("");
                setComment("");
                setOpen(false);
              },
            )
          }
          className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          Save step
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One retrieved passage: where it is from, the statement, the excerpt (collapsed), and the owner's mark with an optional note. */
function ReferenceItem({
  reference: ref,
  mark,
  verdicts,
  textMax,
  pending,
  onMark,
}: {
  reference: InterpretationReference;
  mark: Payload | null;
  verdicts: string[];
  textMax: number;
  pending: boolean;
  onMark: (verdict: string, note: string | undefined, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const verdict = typeof mark?.verdict === "string" ? mark.verdict : null;
  const savedNote = typeof mark?.note === "string" ? mark.note : null;
  const cited = [...new Set(ref.citedBy.map((c) => c.chainOrdinal))];
  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        verdict === "mine" ? "border-primary" : verdict === "not" ? "border-border/60 opacity-70" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {[ref.book, ref.author].filter(Boolean).join(" — ") || "Passage"}
          {ref.pages.length > 0 && ` · p. ${ref.pages.length > 1 ? `${ref.pages[0]}–${ref.pages[ref.pages.length - 1]}` : ref.pages[0]}`}
        </p>
        {cited.length > 0 && (
          <span className="shrink-0 rounded-full border border-gold/60 px-2 py-0.5 text-[11px] text-gold">
            cited in chain {cited.join(", ")}
          </span>
        )}
      </div>
      {ref.headings.length > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">{ref.headings.join(" › ")}</p>}
      {ref.statement && <p className="mt-1.5 text-sm font-medium leading-relaxed">“{ref.statement}”</p>}
      {ref.excerpt && (
        <details className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Excerpt</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{ref.excerpt}</p>
        </details>
      )}
      {ref.factors.length > 0 && <p className="mt-1 break-words text-[11px] text-muted-foreground">{ref.factors.join(" · ")}</p>}

      <div className="mt-2">
        <Chips options={verdicts} value={verdict} disabled={pending} onChoose={(v) => onMark(v, note.trim() || undefined, () => setNote(""))} />
        {savedNote && <p className="mt-1 text-xs italic text-muted-foreground">“{savedNote}”</p>}
        {open ? (
          <div className="mt-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={textMax}
              placeholder="Short note (saved with the mark)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={pending || !verdict || !note.trim()}
                onClick={() => verdict && onMark(verdict, note.trim(), () => setNote(""))}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
              >
                Save with “{verdict ? VERDICT_LABEL[verdict] ?? verdict : "…"}”
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">
                Close
              </button>
            </div>
            {!verdict && <p className="mt-1 text-xs text-muted-foreground">Choose a mark, or tap one to save it with this note.</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-xs text-primary">
            Note
          </button>
        )}
      </div>
    </li>
  );
}

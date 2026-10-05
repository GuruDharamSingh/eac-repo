"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FACTORS } from "@elkdonis/astro-corpus";
import type { ClaimItem, ClaimPassage } from "@elkdonis/astro-corpus/server";
import { claimReviewAction, type ClaimReviewInput } from "@/app/hub/studio/claims/actions";
import { cn } from "@/lib/utils";
import { Footnoted } from "@/components/footnote";
import { footnoteFor, type Footnote } from "@/lib/footnotes";

/**
 * One passage and every claim the AI digest made from it, laid out for a
 * phone.
 *
 * The heading path above the passage shows the placement each heading names
 * (the scope the passage sits in), so you can tell whether the AI read "this
 * position" or "he" against the right placement. Tap a claim to light up the
 * sentences it most likely came from (shared words; approximate). Each claim
 * takes Accurate / Partly / Wrong and quick fixes — wrong placement or tags
 * (remove the AI's keys, add the right ones), a missing condition, not in the
 * passage at all — plus a note. Every save carries the claim's whole current
 * judgement, so the latest one wins. "The AI missed something" adds a claim
 * in your words. "Next passage" draws another; "Skip" passes this one over.
 */

type Payload = Record<string, unknown>;
type Fix = "placement" | "missing-condition" | "not-in-passage";

const VERDICT_LABEL: Record<string, string> = { accurate: "Accurate", partly: "Partly", wrong: "Wrong" };
const VERDICT_STYLE: Record<string, string> = {
  accurate: "border-primary bg-primary text-primary-foreground",
  partly: "border-gold bg-gold/20 text-foreground",
  wrong: "border-destructive bg-destructive/15 text-destructive",
};
const FIX_LABEL: Record<Fix, string> = {
  placement: "Wrong placement / tags",
  "missing-condition": "Missing condition",
  "not-in-passage": "Not in the passage",
};

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function ClaimsCard({ passage, verdicts, textMax }: { passage: ClaimPassage; verdicts: string[]; textMax: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const opened = useRef(performance.now());

  const latest = useMemo(() => {
    const out = new Map<string, Payload>();
    for (const r of passage.reviews) if (r.action === "claim-verdict" && typeof r.payload.statementId === "string") out.set(r.payload.statementId, r.payload);
    return out;
  }, [passage.reviews]);
  const added = passage.reviews.filter((r) => r.action === "claim-add");
  const touched = passage.reviews.length > 0;

  // Footnotes: for each claim, its source sentences, the book's reason and where each tag comes from.
  const footnotes = useMemo(() => {
    const source = {
      textId: passage.textId,
      body: passage.body,
      headings: passage.headings.map((h) => h.text),
      pages: passage.pages,
      book: passage.book,
      author: passage.author,
    };
    return new Map(
      passage.claims.map((c) => [
        c.id,
        footnoteFor(c.body, source, {
          sentences: passage.sentences,
          because: c.because,
          keys: [...c.factors.map((f) => f.key), ...c.conditionKeys.map((k) => k.key)],
        }),
      ]),
    );
  }, [passage]);

  // Which claims point at each sentence, for the little numbers in the passage.
  const claimsBySentence = useMemo(() => {
    const m = new Map<number, number[]>();
    passage.claims.forEach((c, i) => c.sentences.forEach((s) => m.set(s, [...(m.get(s) ?? []), i + 1])));
    return m;
  }, [passage.claims]);
  const lit = new Set(passage.claims.find((c) => c.id === active)?.sentences ?? []);

  const save = (action: ClaimReviewInput["action"], payload: Payload, done?: () => void) =>
    startTransition(async () => {
      const r = await claimReviewAction({
        action,
        payload: { textId: passage.textId, ...payload },
        seconds: Math.round((performance.now() - opened.current) / 1000),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      done?.();
      router.refresh();
    });

  const next = () => router.push("/hub/studio/claims");
  const skip = () =>
    startTransition(async () => {
      const r = await claimReviewAction({ action: "claim-skip", payload: { textId: passage.textId } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.push("/hub/studio/claims");
    });

  return (
    <div className="mt-4">
      {/* Where the passage is from, and the headings it sits under */}
      <p className="text-xs text-muted-foreground">
        {[passage.book, passage.author].filter(Boolean).join(" — ") || "Passage"}
        {passage.pages.length > 0 && ` · p. ${passage.pages.length > 1 ? `${passage.pages[0]}–${passage.pages[passage.pages.length - 1]}` : passage.pages[0]}`}
        {passage.zodiac && ` · ${passage.zodiac}`}
        {!passage.trainable && " · not cleared for training"}
      </p>
      {passage.headings.length > 0 ? (
        <ol className="mt-2 space-y-1">
          {passage.headings.map((h, i) => (
            <li key={i} className="text-sm" style={{ paddingLeft: `${i * 0.75}rem` }}>
              <span className="font-medium">{h.text}</span>
              {h.scope.length > 0 && (
                <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                  {h.scope.map((s) => (
                    <span key={s.key} className="rounded-full border border-gold/60 px-2 py-0.5 text-[11px] text-gold" title={s.key}>
                      {s.label}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">No headings above this passage.</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Gold chips are the placements the headings name: the scope a “he” or “this position” in the passage refers to.
      </p>

      {/* The passage */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="leading-relaxed">
          {passage.sentences.map((s, i) => {
            const nums = claimsBySentence.get(i) ?? [];
            return (
              <span key={i} className={cn("mr-1 rounded px-0.5 transition-colors", lit.has(i) ? "bg-primary/20 ring-1 ring-primary" : nums.length ? "" : "text-muted-foreground")}>
                {s}
                {nums.length > 0 && <sup className="ml-0.5 text-[10px] text-primary">{nums.join(",")}</sup>}
              </span>
            );
          })}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Small numbers mark the claims each sentence most likely gave rise to. Approximate: matched by shared words, so a paraphrase can be missed.
        </p>
      </section>

      {/* The claims */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          What the AI took from it ({passage.claims.length})
        </h2>
        <ol className="mt-3 space-y-3">
          {passage.claims.map((c, i) => (
            <ClaimCard
              key={c.id}
              n={i + 1}
              claim={c}
              footnote={footnotes.get(c.id)!}
              active={active === c.id}
              onActivate={() => setActive(active === c.id ? null : c.id)}
              current={latest.get(c.id) ?? null}
              verdicts={verdicts}
              textMax={textMax}
              pending={pending}
              onSave={(payload, done) => save("claim-verdict", { statementId: c.id, ...payload }, done)}
            />
          ))}
        </ol>
      </section>

      <MissedClaim added={added.map((r) => r.payload)} textMax={textMax} pending={pending} onSave={(payload, done) => save("claim-add", payload, done)} />

      <div className="mt-8 flex gap-2">
        {touched ? (
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Next passage →
          </button>
        ) : (
          <button type="button" onClick={skip} disabled={pending} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm disabled:opacity-50">
            Skip this passage
          </button>
        )}
      </div>
      {!touched && <p className="mt-2 text-center text-xs text-muted-foreground">Judge at least one claim (or skip) to move on; it won&apos;t come back.</p>}
    </div>
  );
}

function ClaimCard({
  n,
  claim: c,
  footnote,
  active,
  onActivate,
  current,
  verdicts,
  textMax,
  pending,
  onSave,
}: {
  n: number;
  claim: ClaimItem;
  /** Where the claim came from and why (lib/footnotes.ts). */
  footnote: Footnote;
  active: boolean;
  onActivate: () => void;
  current: Payload | null;
  verdicts: string[];
  textMax: number;
  pending: boolean;
  onSave: (payload: Payload, done?: () => void) => void;
}) {
  const [panel, setPanel] = useState<"tags" | "condition" | "note" | null>(null);
  const verdict = typeof current?.verdict === "string" ? current.verdict : null;
  const fixes = strs(current?.fixes) as Fix[];
  const tagsAdd = strs(current?.tagsAdd);
  const tagsRemove = strs(current?.tagsRemove);
  const condition = typeof current?.condition === "string" ? current.condition : "";
  const note = typeof current?.note === "string" ? current.note : "";

  /** The claim's whole judgement after a change; a fix needs Partly or Wrong ("not in the passage" needs Wrong). */
  const judgement = (change: { verdict?: string; fixes?: Fix[]; tagsAdd?: string[]; tagsRemove?: string[]; condition?: string; note?: string }) => {
    let v = change.verdict ?? verdict;
    let f = change.fixes ?? fixes;
    if (change.verdict === "accurate") f = [];
    if (change.verdict && change.verdict !== "wrong") f = f.filter((x) => x !== "not-in-passage");
    if (f.includes("not-in-passage")) v = "wrong";
    else if (f.length && (!v || v === "accurate")) v = "partly";
    const accurate = v === "accurate";
    return {
      verdict: v,
      fixes: f,
      tagsAdd: accurate || !f.includes("placement") ? [] : (change.tagsAdd ?? tagsAdd),
      tagsRemove: accurate || !f.includes("placement") ? [] : (change.tagsRemove ?? tagsRemove),
      condition: accurate || !f.includes("missing-condition") ? undefined : (change.condition ?? condition) || undefined,
      note: (change.note ?? note) || undefined,
    };
  };
  const send = (change: Parameters<typeof judgement>[0], done?: () => void) => {
    const j = judgement(change);
    if (!j.verdict) {
      toast.error("Choose Accurate, Partly or Wrong first");
      return;
    }
    onSave(j, done);
  };
  const toggleFix = (f: Fix) => send({ fixes: fixes.includes(f) ? fixes.filter((x) => x !== f) : [...fixes, f] });

  const keyed = [...c.factors.map((f) => ({ key: f.key, label: f.label, note: f.role, mine: f.mine })), ...c.conditionKeys.map((k) => ({ key: k.key, label: k.label, note: "condition", mine: false }))];

  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4",
        active ? "border-primary ring-2 ring-primary/30" : verdict === "wrong" ? "border-destructive/60" : verdict === "accurate" ? "border-primary/50" : "border-border",
      )}
    >
      <button type="button" onClick={onActivate} className="block w-full text-left">
        <span className="text-xs tabular-nums text-muted-foreground">
          Claim {n}
          {c.sentences.length > 0 ? ` · from sentence ${c.sentences.map((s) => s + 1).join(", ")} (approx.)` : " · no matching sentence found"}
          {" · "}
          <span className="text-primary">tap [1] for source and why</span>
        </span>
      </button>
      {/* Not inside the button: the footnote marker is a button of its own. */}
      <p className="mt-1 cursor-pointer font-medium leading-relaxed" onClick={onActivate}>
        <Footnoted text={c.body} notes={[footnote]} />
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {keyed.map((k) => (
          <span
            key={`${k.note}:${k.key}`}
            title={k.key}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              tagsRemove.includes(k.key) ? "border-destructive/60 text-destructive line-through" : k.note === "condition" ? "border-border text-muted-foreground" : "border-primary/40 text-primary",
            )}
          >
            {k.label}
            <span className="ml-1 opacity-70">{k.note}</span>
            {k.mine && <span className="ml-1 text-gold">· your chart</span>}
          </span>
        ))}
        {tagsAdd.map((k) => (
          <span key={`add:${k}`} title={k} className="rounded-full border border-dashed border-primary px-2 py-0.5 text-[11px] text-primary">
            + {FACTOR_LABEL.get(k) ?? k}
          </span>
        ))}
        {keyed.length === 0 && tagsAdd.length === 0 && <span className="text-[11px] text-muted-foreground">no factor keys</span>}
      </div>

      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {c.condition && (
          <>
            <dt>condition</dt>
            <dd className="text-foreground">{c.condition}</dd>
          </>
        )}
        <dt>reads as</dt>
        <dd>
          {[c.valence, c.certainty && `${c.certainty}${c.digestCertainty ? ` (${c.digestCertainty})` : ""}`, c.register, typeof c.frame.zodiac === "string" ? c.frame.zodiac : null, c.lifeArea ? `life area ${c.lifeArea}` : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </dd>
        {c.because && (
          <>
            <dt>because</dt>
            <dd className="italic">{c.because}</dd>
          </>
        )}
        {c.otherFactors.length > 0 && (
          <>
            <dt>also</dt>
            <dd>{c.otherFactors.join(" · ")}</dd>
          </>
        )}
      </dl>

      {/* Verdict and quick fixes */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {verdicts.map((v) => (
          <button
            key={v}
            type="button"
            disabled={pending}
            onClick={() => send({ verdict: v })}
            className={cn("rounded-full border px-3 py-1 text-xs", verdict === v ? VERDICT_STYLE[v] : "border-border text-muted-foreground hover:border-primary/60")}
          >
            {VERDICT_LABEL[v] ?? v}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => setPanel(panel === "tags" ? null : "tags")}
          className={cn("rounded-lg border px-2.5 py-1 text-xs", fixes.includes("placement") ? "border-gold text-gold" : "border-border text-muted-foreground")}
        >
          {FIX_LABEL.placement}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setPanel(panel === "condition" ? null : "condition")}
          className={cn("rounded-lg border px-2.5 py-1 text-xs", fixes.includes("missing-condition") ? "border-gold text-gold" : "border-border text-muted-foreground")}
        >
          {FIX_LABEL["missing-condition"]}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => toggleFix("not-in-passage")}
          className={cn("rounded-lg border px-2.5 py-1 text-xs", fixes.includes("not-in-passage") ? "border-destructive text-destructive" : "border-border text-muted-foreground")}
        >
          {FIX_LABEL["not-in-passage"]}
        </button>
        <button type="button" onClick={() => setPanel(panel === "note" ? null : "note")} className="rounded-lg px-2 py-1 text-xs text-primary">
          Note
        </button>
      </div>
      {condition && <p className="mt-1 text-xs text-muted-foreground">Missing condition: “{condition}”</p>}
      {note && <p className="mt-1 text-xs italic text-muted-foreground">“{note}”</p>}

      {panel === "tags" && (
        <TagFix
          keyed={keyed}
          tagsAdd={tagsAdd}
          tagsRemove={tagsRemove}
          pending={pending}
          onSave={(add, remove) => send({ fixes: [...new Set<Fix>([...fixes, "placement"])], tagsAdd: add, tagsRemove: remove }, () => setPanel(null))}
          onClear={() => send({ fixes: fixes.filter((f) => f !== "placement") }, () => setPanel(null))}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "condition" && (
        <TextFix
          initial={condition}
          placeholder="The condition the claim leaves out (e.g. only when Saturn is retrograde)"
          textMax={textMax}
          pending={pending}
          saveLabel="Save missing condition"
          onSave={(t) => send({ fixes: [...new Set<Fix>([...fixes, "missing-condition"])], condition: t }, () => setPanel(null))}
          onClear={fixes.includes("missing-condition") ? () => send({ fixes: fixes.filter((f) => f !== "missing-condition") }, () => setPanel(null)) : undefined}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "note" && (
        <TextFix
          initial={note}
          placeholder="Note (saved with your verdict)"
          textMax={textMax}
          pending={pending}
          saveLabel="Save note"
          onSave={(t) => send({ note: t }, () => setPanel(null))}
          onClose={() => setPanel(null)}
        />
      )}
    </li>
  );
}

function TextFix({
  initial,
  placeholder,
  textMax,
  pending,
  saveLabel,
  onSave,
  onClear,
  onClose,
}: {
  initial: string;
  placeholder: string;
  textMax: number;
  pending: boolean;
  saveLabel: string;
  onSave: (text: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        maxLength={textMax}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={() => onSave(value.trim())}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saveLabel}
        </button>
        {onClear && (
          <button type="button" disabled={pending} onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-xs">
            Remove this fix
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs">
          Close
        </button>
      </div>
    </div>
  );
}

function TagFix({
  keyed,
  tagsAdd,
  tagsRemove,
  pending,
  onSave,
  onClear,
  onClose,
}: {
  keyed: { key: string; label: string; note: string }[];
  tagsAdd: string[];
  tagsRemove: string[];
  pending: boolean;
  onSave: (add: string[], remove: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [add, setAdd] = useState(tagsAdd);
  const [remove, setRemove] = useState(tagsRemove);
  const onClaim = new Set(keyed.map((k) => k.key));
  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">Tap a key to strike it; add the placement the claim is really about.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {keyed.map((k) => (
          <button
            key={`${k.note}:${k.key}`}
            type="button"
            title={k.key}
            onClick={() => setRemove((r) => (r.includes(k.key) ? r.filter((x) => x !== k.key) : [...r, k.key]))}
            className={cn("rounded-full border px-2 py-0.5 text-[11px]", remove.includes(k.key) ? "border-destructive text-destructive line-through" : "border-border")}
          >
            {k.label} <span className="opacity-60">{k.note}</span>
          </button>
        ))}
        {add.map((k) => (
          <button
            key={`add:${k}`}
            type="button"
            title={k}
            onClick={() => setAdd((a) => a.filter((x) => x !== k))}
            className="rounded-full border border-dashed border-primary px-2 py-0.5 text-[11px] text-primary"
          >
            + {FACTOR_LABEL.get(k) ?? k} ×
          </button>
        ))}
      </div>
      <FactorPicker exclude={[...onClaim, ...add]} onPick={(k) => setAdd((a) => [...a, k])} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || (add.length === 0 && remove.length === 0)}
          onClick={() => onSave(add, remove)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          Save tags
        </button>
        {(tagsAdd.length > 0 || tagsRemove.length > 0) && (
          <button type="button" disabled={pending} onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-xs">
            Remove this fix
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs">
          Close
        </button>
      </div>
    </div>
  );
}

/** Possible factors only (the registry, without the impossible ones), searched by label or key. */
const PICKABLE = FACTORS.filter((f) => !f.impossible).map((f) => ({ key: f.key, label: f.label, hay: `${f.label} ${f.key}`.toLowerCase() }));
const FACTOR_LABEL = new Map(FACTORS.map((f) => [f.key, f.label]));

function FactorPicker({ exclude, onPick }: { exclude: string[]; onPick: (key: string) => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? PICKABLE.filter((f) => !exclude.includes(f.key) && words.every((w) => f.hay.includes(w))).slice(0, 8) : [];
  return (
    <div className="mt-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a placement: saturn 7th, moon scorpio, venus square mars"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        autoCapitalize="none"
        autoCorrect="off"
      />
      {hits.length > 0 && (
        <ul className="mt-1 divide-y divide-border/60 rounded-lg border border-border">
          {hits.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(f.key);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>{f.label}</span>
                <span className="text-[11px] text-muted-foreground">{f.key}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MissedClaim({
  added,
  textMax,
  pending,
  onSave,
}: {
  added: Payload[];
  textMax: number;
  pending: boolean;
  onSave: (payload: Payload, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  return (
    <section className="mt-6">
      {added.length > 0 && (
        <div className="rounded-xl border border-dashed border-primary/50 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-primary">Claims you added</p>
          <ul className="mt-1 space-y-1 text-sm">
            {added.map((p, i) => (
              <li key={i}>
                {String(p.body)}
                {strs(p.factorKeys).length > 0 && (
                  <span className="ml-1 text-[11px] text-muted-foreground">· {strs(p.factorKeys).map((k) => FACTOR_LABEL.get(k) ?? k).join(" · ")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {open ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-4">
          <label className="block text-sm font-medium" htmlFor="missed">
            What the AI missed
          </label>
          <textarea
            id="missed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={textMax}
            placeholder="The claim, standing on its own: “Saturn in the 7th delays marriage until about 30.”"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKeys((ks) => ks.filter((x) => x !== k))}
                className="rounded-full border border-primary/50 px-2 py-0.5 text-[11px] text-primary"
              >
                {FACTOR_LABEL.get(k) ?? k} ×
              </button>
            ))}
          </div>
          <FactorPicker exclude={keys} onPick={(k) => setKeys((ks) => [...ks, k])} />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending || !body.trim()}
              onClick={() =>
                onSave({ body: body.trim(), factorKeys: keys }, () => {
                  setBody("");
                  setKeys([]);
                  setOpen(false);
                })
              }
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              Save claim
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-primary">
          + The AI missed something
        </button>
      )}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deactivateCriterion,
  upsertCriterion,
  upsertTier,
} from "@/lib/manage/actions";
import type { Criterion, Tier } from "@/lib/types";

/**
 * The rubric editor.
 *
 * This is the screen that makes "the rubric will change" true rather than
 * aspirational. Every row here is a database row that the submit form, the
 * public /rubric page and the rating queue all read, so they can never drift
 * from each other.
 *
 * Two things are deliberately constrained:
 *  - `auto` criteria can only name an evaluator that exists in src/lib/rubric.ts.
 *    Picking one that doesn't means the criterion is silently never awarded.
 *  - Retiring a criterion deactivates it rather than deleting it, so past
 *    ratings keep their reasoning.
 */

const AUTO_CHECKS = [
  { value: "has_front", label: "A front-on shot exists" },
  { value: "has_side", label: "A side profile exists" },
  { value: "aspect_3_4", label: "Roughly 3:4 portrait" },
  { value: "min_long_edge_1200", label: "At least 1200px long edge" },
];

export function RubricEditor({
  criteria,
  tiers,
}: {
  criteria: Criterion[];
  tiers: Tier[];
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function save(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(msg);
      else toast.error(res.error ?? "That didn't save.");
    });
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Criteria</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Changing these changes the submit form and the public rubric page at the same
              time. Ratings already given keep the points they were awarded.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-1 size-4" />
            New
          </Button>
        </div>

        {adding && (
          <CriterionForm
            pending={pending}
            onCancel={() => setAdding(false)}
            onSave={(values) =>
              save(() => upsertCriterion(values), `Added “${values.label}”.`)
            }
          />
        )}

        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
          {criteria.map((c) => (
            <CriterionRow key={c.key} criterion={c} pending={pending} save={save} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Rarity tiers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The score only picks the provisional band shown before you rate a card. Your verdict
          always overrides it.
        </p>

        <ul className="mt-4 space-y-3">
          {tiers.map((t) => (
            <TierRow key={t.slug} tier={t} pending={pending} save={save} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CriterionRow({
  criterion,
  pending,
  save,
}: {
  criterion: Criterion;
  pending: boolean;
  save: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void;
}) {
  const [label, setLabel] = useState(criterion.label);
  const [hint, setHint] = useState(criterion.hint ?? "");
  const [points, setPoints] = useState(String(criterion.points));

  const dirty =
    label !== criterion.label ||
    hint !== (criterion.hint ?? "") ||
    points !== String(criterion.points);

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="font-medium" />
        <Input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Hint shown under the label"
          className="text-sm"
        />
      </div>

      <div className="w-20">
        <Label className="text-xs text-muted-foreground">Points</Label>
        <Input
          type="number"
          min={0}
          max={20}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
      </div>

      <span className="w-24 text-xs uppercase text-muted-foreground">{criterion.source}</span>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !dirty}
          onClick={() =>
            save(
              () =>
                upsertCriterion({
                  key: criterion.key,
                  label,
                  hint: hint || null,
                  category: criterion.category,
                  points: Number(points) || 0,
                  source: criterion.source,
                  autoCheck: criterion.autoCheck,
                  isActive: true,
                  sortOrder: criterion.sortOrder,
                }),
              "Saved."
            )
          }
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Retire “${criterion.label}”? Past ratings keep their points.`)) return;
            save(() => deactivateCriterion(criterion.key), "Retired.");
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function CriterionForm({
  pending,
  onSave,
  onCancel,
}: {
  pending: boolean;
  onSave: (values: Parameters<typeof upsertCriterion>[0]) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [points, setPoints] = useState("2");
  const [source, setSource] = useState<"submitter" | "auto" | "owner">("submitter");
  const [autoCheck, setAutoCheck] = useState(AUTO_CHECKS[0].value);

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-primary/40 bg-accent/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Shot in the rain"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hint</Label>
          <Input value={hint} onChange={(e) => setHint(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Points</Label>
          <Input
            type="number"
            min={0}
            max={20}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Who decides</Label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="submitter">The submitter ticks it</option>
            <option value="auto">Checked automatically</option>
            <option value="owner">Only you</option>
          </select>
        </div>
        {source === "auto" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>What to check</Label>
            <select
              value={autoCheck}
              onChange={(e) => setAutoCheck(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {AUTO_CHECKS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only these four can be measured today. Anything else needs an evaluator adding to
              src/lib/rubric.ts first.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !label.trim()}
          onClick={() => {
            onSave({
              key: label,
              label,
              hint: hint || null,
              category: "craft",
              points: Number(points) || 0,
              source,
              autoCheck: source === "auto" ? autoCheck : null,
              isActive: true,
              sortOrder: 500,
            });
            onCancel();
          }}
        >
          Add it
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TierRow({
  tier,
  pending,
  save,
}: {
  tier: Tier;
  pending: boolean;
  save: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void;
}) {
  const [label, setLabel] = useState(tier.label);
  const [blurb, setBlurb] = useState(tier.blurb ?? "");
  const [minScore, setMinScore] = useState(String(tier.minScore));
  const [accent, setAccent] = useState(tier.accentHex);
  const [frame, setFrame] = useState(tier.frameStyle);

  const dirty =
    label !== tier.label ||
    blurb !== (tier.blurb ?? "") ||
    minScore !== String(tier.minScore) ||
    accent !== tier.accentHex ||
    frame !== tier.frameStyle;

  return (
    <li className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <input
        type="color"
        value={accent}
        onChange={(e) => setAccent(e.target.value)}
        className="size-9 cursor-pointer rounded border border-border bg-transparent"
        aria-label={`${tier.label} colour`}
      />
      <div className="min-w-[10rem] flex-1 space-y-1.5">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="One line"
          className="text-sm"
        />
      </div>
      <div className="w-24">
        <Label className="text-xs text-muted-foreground">Min score</Label>
        <Input
          type="number"
          min={0}
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />
      </div>
      <div className="w-28">
        <Label className="text-xs text-muted-foreground">Frame</Label>
        <select
          value={frame}
          onChange={(e) => setFrame(e.target.value as Tier["frameStyle"])}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="plain">Plain</option>
          <option value="metal">Metal</option>
          <option value="foil">Foil</option>
          <option value="holo">Holo</option>
        </select>
      </div>
      <Button
        size="sm"
        disabled={pending || !dirty}
        onClick={() =>
          save(
            () =>
              upsertTier({
                slug: tier.slug,
                label,
                blurb: blurb || null,
                minScore: Number(minScore) || 0,
                accentHex: accent,
                frameStyle: frame,
                isActive: true,
                sortOrder: tier.sortOrder,
              }),
            "Saved."
          )
        }
      >
        Save
      </Button>
    </li>
  );
}

"use client";

import { useState, useTransition } from "react";
import { matchGroup } from "@elkdonis/astro-corpus";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VocabGroupsView } from "@elkdonis/astro-corpus/server";
import { vocabReviewAction, type VocabReviewInput } from "@/app/hub/studio/vocabulary/actions";
import { useVocabUndo } from "@/components/studio/use-vocab-undo";

/**
 * The groups view: rename a group (or merge it into another by renaming it
 * to that one's name), and edit a card's groups (a card in several groups is
 * listed under each, marked "also in"). An edit is a new vocab-sort for the
 * card, keeping its label. Every change shows a toast with "Undo". Tap a card
 * to re-sort it on the sorting page.
 *
 * Groups nest ("Set parent…": Malefics under Planets); the page shows the
 * tree, collapsible. Groups that look like the same one (Aspect / Aspects)
 * are offered for a one-click merge, keeping the name he picks.
 */
export function VocabGroups({ view }: { view: VocabGroupsView }) {
  const router = useRouter();
  const notify = useVocabUndo();
  const [pending, startTransition] = useTransition();
  const names = view.names;
  const byName = new Map(view.groups.map((g) => [g.name, g]));
  const childrenOf = (name: string) => view.groups.filter((g) => view.parents[g.name] === name);
  const roots = view.groups.filter((g) => !view.parents[g.name] || !byName.has(view.parents[g.name]));

  const send = (action: VocabReviewInput["action"], payload: Record<string, unknown>, message: string, done?: () => void) =>
    startTransition(async () => {
      const r = await vocabReviewAction({ action, payload });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      notify(message, r.reviewId);
      done?.();
      router.refresh();
    });

  return (
    <div className="mt-6 space-y-4">
      {view.groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet: sort a few cards first.</p>}

      {view.similar.map((cluster) => (
        <MergePrompt key={cluster.join("|")} cluster={cluster} pending={pending} send={send} />
      ))}

      {roots.map((g) => (
        <GroupNode key={g.name} group={g} byName={byName} childrenOf={childrenOf} names={names} parents={view.parents} pending={pending} send={send} />
      ))}

      {view.added.length > 0 && (
        <section className="rounded-2xl border border-dashed border-primary/50 p-4 text-sm">
          <h2 className="font-semibold">
            Your added terms <span className="font-normal tabular-nums text-muted-foreground">{view.added.length}</span>
          </h2>
          <ul className="mt-2 space-y-1">
            {view.added.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <Link href={`/hub/studio/vocabulary?c=${a.id}`} className="hover:text-primary">
                  {a.term}
                  {a.fromTerm && <span className="text-xs text-muted-foreground"> · from “{a.fromTerm}”</span>}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.decision === "group" ? (a.group ?? "sorted") : a.decision === "not-a-term" ? "not a term" : a.decision === "skip" ? "skipped" : "not sorted yet"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {[
        { title: "Not a term", list: view.notTerms },
        { title: "Skipped", list: view.skipped },
      ].map(
        (s) =>
          s.list.length > 0 && (
            <details key={s.title} className="rounded-2xl border border-border/60 p-4 text-sm">
              <summary className="cursor-pointer select-none font-medium">
                {s.title} ({s.list.length})
              </summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.list.map((c) => (
                  <Link key={c.id} href={`/hub/studio/vocabulary?c=${c.id}`} className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-primary/60">
                    {c.term}
                  </Link>
                ))}
              </div>
            </details>
          ),
      )}
    </div>
  );
}

type Send = (action: VocabReviewInput["action"], payload: Record<string, unknown>, message: string, done?: () => void) => void;
type GroupItem = VocabGroupsView["groups"][number];

/** "These look like the same group": merge the others into the name he keeps. */
function MergePrompt({ cluster, pending, send }: { cluster: string[]; pending: boolean; send: Send }) {
  return (
    <section className="rounded-2xl border border-gold/70 bg-gold/5 px-4 py-3 text-sm">
      <p>
        These look like the same group: <span className="font-medium">{cluster.join(" / ")}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cluster.map((keep) => (
          <button
            key={keep}
            type="button"
            disabled={pending}
            onClick={() => {
              for (const from of cluster.filter((n) => n !== keep)) send("vocab-group", { from, to: keep }, `Merged “${from}” into “${keep}”`);
            }}
            className="rounded-lg border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            Merge, keep “{keep}”
          </button>
        ))}
      </div>
    </section>
  );
}

/** One group and, nested and collapsible, the groups under it. */
function GroupNode({
  group,
  byName,
  childrenOf,
  names,
  parents,
  pending,
  send,
  depth = 0,
}: {
  group: GroupItem;
  byName: Map<string, GroupItem>;
  childrenOf: (name: string) => GroupItem[];
  names: string[];
  parents: Record<string, string>;
  pending: boolean;
  send: Send;
  depth?: number;
}) {
  const kids = depth < 8 ? childrenOf(group.name) : [];
  // Groups it may be nested under: not itself, not anything already under it.
  const below = new Set<string>();
  const walk = (n: string) => {
    for (const c of childrenOf(n)) if (!below.has(c.name)) {
      below.add(c.name);
      walk(c.name);
    }
  };
  walk(group.name);
  const candidates = names.filter((n) => n !== group.name && !below.has(n));
  return (
    <div>
      <Group group={group} names={names} parent={parents[group.name] ?? null} candidates={candidates} pending={pending} send={send} />
      {kids.length > 0 && (
        <details open className="ml-3 mt-2 border-l border-border pl-3">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground">
            {kids.length} group{kids.length === 1 ? "" : "s"} under “{group.name}”
          </summary>
          <div className="mt-2 space-y-3">
            {kids.map((k) => (
              <GroupNode key={k.name} group={k} byName={byName} childrenOf={childrenOf} names={names} parents={parents} pending={pending} send={send} depth={depth + 1} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Group({
  group: g,
  names,
  parent,
  candidates,
  pending,
  send,
}: {
  group: GroupItem;
  names: string[];
  parent: string | null;
  candidates: string[];
  pending: boolean;
  send: (action: VocabReviewInput["action"], payload: Record<string, unknown>, message: string, done?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState(g.name);
  const [moving, setMoving] = useState<string | null>(null);
  const others = names.filter((n) => n !== g.name);
  const target = to.replace(/\s+/g, " ").trim();
  // Renaming to a near-duplicate of another group (Aspects → Aspect) is a merge into it.
  const merging = target ? matchGroup(target, others) : null;
  const [nesting, setNesting] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {g.name} <span className="text-sm font-normal tabular-nums text-muted-foreground">{g.total}</span>
          {parent && <span className="ml-1 text-xs font-normal text-muted-foreground">in {parent}</span>}
        </h2>
        <span className="flex shrink-0 gap-3">
          <button type="button" onClick={() => setNesting(!nesting)} className="text-xs text-primary">
            {nesting ? "Close" : "Set parent…"}
          </button>
          <button type="button" onClick={() => setEditing(!editing)} className="text-xs text-primary">
            {editing ? "Close" : "Rename / merge"}
          </button>
        </span>
      </header>
      {nesting && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-xs">
          <span className="text-muted-foreground">Put “{g.name}” under</span>
          <select
            defaultValue={parent ?? ""}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value || null;
              if (next === parent) return;
              send(
                "vocab-group-parent",
                { group: g.name, parent: next },
                next ? `“${g.name}” is now under “${next}”` : `“${g.name}” is now a top-level group`,
                () => setNesting(false),
              );
            }}
            className="rounded-lg border border-border bg-background px-2 py-1"
          >
            <option value="">(top level)</option>
            {candidates.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
      {editing && (
        <div className="mt-2 rounded-xl border border-border p-3">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            maxLength={80}
            list={`groups-${g.name}`}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <datalist id={`groups-${g.name}`}>
            {others.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-muted-foreground">
            {merging ? `Merges every card into “${merging}”.` : "A new name renames the group; another group's name merges it into that one."}
          </p>
          <button
            type="button"
            disabled={pending || !target || target === g.name}
            onClick={() =>
              send("vocab-group", { from: g.name, to: merging ?? target }, merging ? `Merged “${g.name}” into “${merging}”` : `Renamed “${g.name}” → “${target}”`, () =>
                setEditing(false),
              )
            }
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            {merging ? "Merge" : "Rename"}
          </button>
        </div>
      )}
      <ul className="mt-3 space-y-1.5">
        {g.cards.map((c) => (
          <li key={c.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/hub/studio/vocabulary?c=${c.id}`} className="hover:text-primary">
                {c.preferred ?? c.term}
                {c.preferred && <span className="text-xs text-muted-foreground"> ({c.term})</span>}
                {c.ownerAdded && <span className="ml-1 text-[10px] text-primary">yours</span>}
                {c.exampleRatings.good + c.exampleRatings.weak + c.exampleRatings.wrongSense > 0 && (
                  <span
                    className="ml-1.5 text-[10px] text-muted-foreground"
                    title="Your ratings of its example sentences: good · weak · wrong sense"
                  >
                    examples {c.exampleRatings.good}✓ {c.exampleRatings.weak}~ {c.exampleRatings.wrongSense}✗
                  </span>
                )}
              </Link>
              <button type="button" onClick={() => setMoving(moving === c.id ? null : c.id)} className="shrink-0 text-xs text-muted-foreground hover:text-primary">
                Edit groups
              </button>
            </div>
            {c.alsoIn.length > 0 && <p className="ml-4 text-[11px] text-muted-foreground">also in: {c.alsoIn.join(", ")}</p>}
            {c.synonyms.length > 0 && (
              <p className="ml-4 text-xs text-muted-foreground">
                = {c.synonyms.map((s) => s.preferred ?? s.term).join(" · ")}
              </p>
            )}
            {c.note && <p className="ml-4 text-xs italic text-muted-foreground">“{c.note}”</p>}
            {moving === c.id && (
              <EditGroups
                initial={c.groups}
                names={names}
                pending={pending}
                onSave={(groups) =>
                  send(
                    "vocab-sort",
                    { cardId: c.id, verdict: "group", groups, preferred: c.preferred ?? undefined, note: c.note ?? undefined },
                    `“${c.preferred ?? c.term}” → ${groups.join(", ")}`,
                    () => setMoving(null),
                  )
                }
                onClose={() => setMoving(null)}
              />
            )}
          </li>
        ))}
        {g.cards.length === 0 && <li className="text-xs text-muted-foreground">Only synonyms of cards in other groups.</li>}
      </ul>
    </section>
  );
}

/** Choose every group a card belongs to: tick existing ones, or name a new one. */
function EditGroups({
  initial,
  names,
  pending,
  onSave,
  onClose,
}: {
  initial: string[];
  names: string[];
  pending: boolean;
  onSave: (groups: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(initial);
  const [fresh, setFresh] = useState("");
  const all = [...names, ...chosen.filter((c) => !names.includes(c))];
  const toggle = (n: string) => setChosen((c) => (c.includes(n) ? c.filter((x) => x !== n) : c.length >= 8 ? c : [...c, n]));
  return (
    <div className="ml-4 mt-1 rounded-xl border border-border p-2">
      <div className="flex flex-wrap gap-1.5">
        {all.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => toggle(n)}
            className={chosen.includes(n) ? "rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs text-primary-foreground" : "rounded-full border border-border px-2.5 py-0.5 text-xs"}
          >
            {chosen.includes(n) ? "✓ " : ""}
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && fresh.trim()) {
              toggle(fresh.replace(/\s+/g, " ").trim());
              setFresh("");
            }
          }}
          maxLength={80}
          placeholder="New group"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={pending || chosen.length === 0}
          onClick={() => onSave(chosen)}
          className="rounded-lg bg-primary px-2.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          Save ({chosen.length})
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-2 text-xs">
          Close
        </button>
      </div>
    </div>
  );
}

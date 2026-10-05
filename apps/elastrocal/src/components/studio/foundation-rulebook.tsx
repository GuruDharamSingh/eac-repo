import { citeText } from "@elkdonis/astro-corpus";
import type { ConceptEntry, FoundationCatalogueView, PassageEntry, TraitEntry } from "@elkdonis/astro-corpus/server";
import { FACET_HEADING, GROUP_LABEL, MODE_LABEL, ROLE_LABEL, label } from "@/components/studio/foundation-labels";

/**
 * The rulebook entry of one basic idea, in plain reading form: what the
 * owner has confirmed so far. Used on the review page (a folding panel) and
 * on the lesson's rulebook page. This is what the next model pass is given.
 */

function TraitLine({ list }: { list: TraitEntry[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {list.map((t) => (
        <li key={t.id}>
          <span className="font-medium">{t.text}</span>
          {t.synonyms.length > 0 && <span className="text-muted-foreground"> (also: {t.synonyms.map((s) => s.text).join(", ")})</span>}
          {t.yours ? <span className="text-xs text-gold"> · yours</span> : <span className="text-xs text-muted-foreground"> · {t.books} book{t.books === 1 ? "" : "s"}</span>}
          {t.note && <span className="text-xs italic text-muted-foreground"> · “{t.note}”</span>}
        </li>
      ))}
    </ul>
  );
}

function Traits({ title, list }: { title: string; list: TraitEntry[] }) {
  if (!list.length) return null;
  const facets = (["itself", "dominant", "lacking"] as const).filter((f) => list.some((t) => t.facet === f));
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {facets.map((f) => (
        <div key={f}>
          {(facets.length > 1 || f !== "itself") && <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{FACET_HEADING[f]}</p>}
          <TraitLine list={list.filter((t) => t.facet === f)} />
        </div>
      ))}
    </div>
  );
}

function Passages({ title, list }: { title: string; list: PassageEntry[] }) {
  if (!list.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-1 space-y-3">
        {list.map((p) => (
          <li key={p.id} className="border-l-2 border-gold/60 pl-3">
            <p className="whitespace-pre-line leading-relaxed">“{p.text}”</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              — {citeText(p.citation) || "source unknown"} · {label(MODE_LABEL, p.mode)} · {label(ROLE_LABEL, p.role)}
              {p.corrected && (
                <span className="text-gold">
                  {" "}
                  · you corrected the AI (it said: {label(MODE_LABEL, p.modelMode)}, {label(ROLE_LABEL, p.modelRole).toLowerCase()})
                </span>
              )}
            </p>
            {p.note && <p className="text-xs italic text-muted-foreground">Your note: “{p.note}”</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RulebookEntry({ name, entry }: { name: string; entry: ConceptEntry }) {
  const nothing =
    !entry.definition && !entry.traits.core.length && !entry.traits.fits.length && !entry.images.apt.length && !entry.passages.good.length && !entry.figurative.counts.length && !entry.notes.length;
  if (nothing) return <p className="text-sm text-muted-foreground">Nothing confirmed for {name} yet. What you mark Core, Fits, Apt or Good teaching shows up here.</p>;
  return (
    <div className="text-sm">
      {entry.definition ? (
        <p className="whitespace-pre-line rounded-xl border border-gold/50 bg-gold/5 px-4 py-3 leading-relaxed">{entry.definition}</p>
      ) : (
        <p className="text-muted-foreground">You have not written your definition of {name} yet.</p>
      )}
      <Traits title="Core qualities" list={entry.traits.core} />
      <Traits title="Also fits (secondary)" list={entry.traits.fits} />
      {entry.images.apt.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold">Pictures that fit</h4>
          <ul className="mt-1 space-y-1">
            {entry.images.apt.map((i) => (
              <li key={i.id}>
                <span className="font-medium">{i.text}</span>
                {i.meaning && <span>: {i.meaning}</span>}
                <span className="text-xs text-muted-foreground"> · {i.yours ? "yours" : citeText(i.citation)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Passages title="Good teaching passages" list={entry.passages.good} />
      <Passages title={`Figures of speech that do count as ${name}`} list={entry.figurative.counts} />
      {entry.notes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold">Your notes</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {entry.notes.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
      {entry.traits.rejected.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Not {name} (rejected): {entry.traits.rejected.map((t) => t.text).join(", ")}
        </p>
      )}
    </div>
  );
}

/** The confirmed basic terms of each book ("Right"), grouped, with the keywords that stand. */
export function RulebookTerms({ catalogues }: { catalogues: FoundationCatalogueView[] }) {
  const books = catalogues.filter((c) => c.terms.some((t) => t.verdict === "right"));
  if (!books.length) return <p className="text-sm text-muted-foreground">No basic terms confirmed yet. Terms you mark “Right” show up here.</p>;
  return (
    <div className="space-y-6 text-sm">
      {books.map((c) => {
        const right = c.terms.filter((t) => t.verdict === "right");
        const groups = [...new Set(right.map((t) => t.group))];
        return (
          <div key={c.slug}>
            <h3 className="font-semibold">
              {c.book}
              {c.author && <span className="font-normal text-muted-foreground"> · {c.author}</span>}
            </h3>
            {groups.map((g) => (
              <div key={g} className="mt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label(GROUP_LABEL, g)}</p>
                <ul className="mt-1 space-y-1.5">
                  {right
                    .filter((t) => t.group === g)
                    .map((t) => (
                      <li key={t.id}>
                        <span className="font-medium">{t.term}</span>
                        {t.keywords.length > 0 && <span className="text-muted-foreground"> — {t.keywords.join(", ")}</span>}
                        {t.definition && <span className="block text-muted-foreground">{t.definition}</span>}
                        {t.note && <span className="block text-xs italic text-muted-foreground">Your note: “{t.note}”</span>}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

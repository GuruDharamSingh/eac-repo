"use client";

import { useMemo, useState } from "react";
import type { FoundationSource, LibraryKeyword, LibraryNoteView, LibraryPassage, LibrarySilo } from "@elkdonis/astro-corpus/server";
import { LibraryNote } from "@/components/studio/library-note";
import { READING_GROUPS, readingGroup, readingLabel } from "@elkdonis/astro-corpus";
import { foundationSourcesAction } from "@/app/hub/studio/foundations/actions";
import { libraryPassageAction } from "@/app/hub/studio/library/actions";
import { cn } from "@/lib/utils";
import { BALANCE_HEADING, FACET_HEADING, MODE_LABEL, ROLE_LABEL, label } from "@/components/studio/foundation-labels";

/**
 * One Library silo (Fire, Aries, Jupiter in Capricorn, …), for looking things
 * up: every keyword with the books that give it (most-agreed first, nothing
 * hidden), the passages filed there, the facts each book gives, and — for a
 * placement — famous people. "Only this book" narrows all of it. Source lines
 * and passage context are fetched when opened; long lists show more on request.
 */

const PAGE = 40;
const pagesText = (p: number[]) => (p.length ? `p. ${p.join(", ")}` : null);
const ORIGIN_LABEL: Record<LibraryPassage["origin"], string> = { "book section": "the book’s own section", passage: "reference passage", "book passage": "", "earlier pass": "from the earlier pass" };

export function LibrarySiloView({ silo, notes = {} }: { silo: LibrarySilo; notes?: Record<string, LibraryNoteView> }) {
  const here = { type: silo.type, subject: silo.subject };
  const short = (t: string, n = 220) => (t.length > n ? `${t.slice(0, n)}…` : t);
  const [book, setBook] = useState("");
  const [openKeyword, setOpenKeyword] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, FoundationSource[]>>({});
  const [shown, setShown] = useState(PAGE);
  const [tone, setTone] = useState<"" | "positive" | "negative">("");
  const anyTone = silo.keywords.some((k) => k.tones.length);
  const has = (b: string) => !book || b === book;
  const readings = silo.readings.filter((r) => has(r.book));

  const keywords = useMemo(() => silo.keywords.filter((k) => k.sources.some((s) => has(s.book)) && (!tone || k.tones.includes(tone))), [silo.keywords, book, tone]); // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, setKind] = useState("");
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const loadBody = (textId: string) => {
    if (!bodies[textId]) void libraryPassageAction(textId).then((b) => b && setBodies((x) => ({ ...x, [textId]: b })));
  };
  const inBook = silo.passages.filter((p) => has(p.book));
  const kindCounts = READING_GROUPS.map((g) => ({ ...g, n: inBook.filter((p) => readingGroup(p.kind) === g.key).length })).filter((g) => g.n);
  const passages = inBook.filter((p) => !kind || readingGroup(p.kind) === kind);
  const facts = silo.facts.map((f) => ({ ...f, values: f.values.filter((v) => has(v.book)) })).filter((f) => f.values.length);
  const facets = ["itself", "dominant", "lacking"].filter((f) => keywords.some((k) => k.facet === f));

  const open = (k: LibraryKeyword) => {
    const id = `${k.facet}|${k.text}`;
    setOpenKeyword(openKeyword === id ? null : id);
    const need = k.itemIds.filter((i) => !lines[i]);
    if (need.length) void foundationSourcesAction(need).then((r) => setLines((l) => ({ ...l, ...r })));
  };
  const loadContext = (itemId: string) => {
    if (!lines[itemId]) void foundationSourcesAction([itemId]).then((r) => setLines((l) => ({ ...l, ...r })));
  };

  return (
    <div className="mt-4">
      <h1 className="text-3xl font-semibold">{silo.label}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {silo.keywords.length.toLocaleString()} keywords · {(silo.passages.length + silo.passagesMore).toLocaleString()} passages · {silo.facts.length} kinds of fact · from {silo.books.length} book
        {silo.books.length === 1 ? "" : "s"}. This page is for looking things up; nothing here asks for a decision. Use ✎ to leave a note on anything.
      </p>
      <LibraryNote box targetType="silo" targetId={`${silo.type}/${silo.subject}`} silo={here} context={silo.label} note={notes[`silo|${silo.type}/${silo.subject}`]} />
      {silo.books.length > 1 && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show:</span>
          <select value={book} onChange={(e) => (setBook(e.target.value), setShown(PAGE))} className="max-w-full rounded-lg border border-border bg-background px-2 py-1 text-sm">
            <option value="">All books</option>
            {silo.books.map((b) => (
              <option key={b} value={b}>
                Only: {b}
              </option>
            ))}
          </select>
        </label>
      )}
      {kindCounts.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-sm text-muted-foreground">Kind of reading:</span>
          {[{ key: "", label: "All", n: inBook.length }, ...kindCounts].map((g) => (
            <button key={g.key} type="button" aria-pressed={kind === g.key} onClick={() => (setKind(g.key), setShown(PAGE))} className={cn("rounded-full border px-3 py-1", kind === g.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>
              {g.label} <span className="tabular-nums opacity-80">{g.n}</span>
            </button>
          ))}
        </div>
      )}

      {silo.people.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Famous people with this placement</h2>
          <p className="mt-1 text-sm">
            {silo.people.map((p, i) => (
              <span key={p.name} title={p.book}>
                {i > 0 && " · "}
                {p.name}
              </span>
            ))}
          </p>
        </section>
      )}

      {readings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">How authors reason from it</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lines from worked chart readings where the author says which part of the chart each statement comes from. The marked words are what is said; the list under the line gives the
            reason for each.
          </p>
          <ul className="mt-3 space-y-3">
            {readings.map((r) => {
              const says = r.parts.map((p) => p.says).filter((x) => r.sentence.includes(x));
              const re = says.length ? new RegExp(`(${says.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g") : null;
              const mine = (because: string) => silo.subject.split(/[:/]/).some((w) => w !== "sign" && because.toLowerCase().includes(w)) || because.toLowerCase().includes(silo.label.toLowerCase());
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <p className="leading-relaxed">
                    {re ? r.sentence.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-gold/25 px-0.5 text-foreground">{part}</mark> : part)) : r.sentence}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {r.parts.map((p, i) => (
                      <li key={i} className={cn(mine(p.because) ? "text-foreground" : "text-muted-foreground")}>
                        “{p.says}” <span className="text-muted-foreground">because of</span> <b className={cn("font-semibold", mine(p.because) && "text-primary")}>{p.because}</b>
                      </li>
                    ))}
                  </ul>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-x-2">
                    <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">— {[r.book, r.page ? `p. ${r.page}` : null, r.placement].filter(Boolean).join(" · ")}</span>
                    <LibraryNote targetType="reading" targetId={r.id} silo={here} context={`${silo.label}, reading in ${r.book}${r.page ? `, p. ${r.page}` : ""}: “${short(r.sentence)}”`} note={notes[`reading|${r.id}`]} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(keywords.length > 0 || tone) && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Keywords</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every word any book gives for {silo.label}. Words more books agree on come first; single-book words follow in the same list. Click a word to see the lines it came from.
            {anyTone && " A + or − is shown only where the book itself calls the word positive or negative."}
          </p>
          {anyTone && (
            <div className="mt-2 flex gap-1.5 text-xs">
              {(["", "positive", "negative"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(t)} className={cn("rounded-full border px-3 py-1", tone === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>
                  {t === "" ? "All" : t === "positive" ? "+ positive" : "− negative"}
                </button>
              ))}
            </div>
          )}
          {facets.map((f) => {
            const list = keywords.filter((k) => k.facet === f);
            return (
              <div key={f} className="mt-4">
                {f !== "itself" && f === facets.find((x) => x !== "itself") && <h3 className="mb-2 text-sm font-semibold">{BALANCE_HEADING[silo.type] ?? "Its balance in a chart"}</h3>}
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {f === "itself" ? `${silo.label} itself` : FACET_HEADING[f]} <span className="tabular-nums">· {list.length}</span>
                </h3>
                <ul className="mt-1.5 divide-y divide-border/60 rounded-xl border border-border">
                  {list.map((k) => {
                    const id = `${k.facet}|${k.text}`;
                    const isOpen = openKeyword === id;
                    const src = k.sources.filter((s) => has(s.book));
                    const loaded = k.itemIds.flatMap((i) => lines[i] ?? []).filter((l) => has(l.book ?? "?"));
                    return (
                      <li key={id} className="px-3 py-1.5">
                        <div className="flex flex-wrap items-start gap-x-1">
                        <button type="button" onClick={() => open(k)} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-left">
                          <span className="font-medium">
                            {k.label && <span className="mr-1 text-xs font-normal text-muted-foreground/70">{k.label}:</span>}
                            {k.text}
                            {k.tones.includes("positive") && <span className="ml-1 text-xs font-semibold text-primary" title="The book marks it positive">+</span>}
                            {k.tones.includes("negative") && <span className="ml-1 text-xs font-semibold text-destructive" title="The book marks it negative">−</span>}
                          </span>
                          <span className={cn("shrink-0 rounded-full px-1.5 text-[11px] tabular-nums", k.books >= 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                            {k.books} book{k.books === 1 ? "" : "s"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{[...new Set(src.map((s) => s.book))].join(" · ")}</span>
                        </button>
                        <LibraryNote
                          targetType="keyword"
                          targetId={`${silo.type}/${silo.subject}|${k.facet}|${k.text.toLowerCase()}`}
                          silo={here}
                          context={`${silo.label} keyword “${k.text}”${k.facet !== "itself" ? ` (${FACET_HEADING[k.facet]})` : ""}: ${k.books} book${k.books === 1 ? "" : "s"} (${[...new Set(k.sources.map((x) => x.book))].slice(0, 4).join("; ")})`}
                          note={notes[`keyword|${silo.type}/${silo.subject}|${k.facet}|${k.text.toLowerCase()}`]}
                        />
                        </div>
                        {isOpen && (
                          <div className="mb-1 mt-1.5 space-y-2 border-l-2 border-gold/60 pl-3 text-sm">
                            {src
                              .filter((s) => s.via === "keyword list")
                              .map((s, i) => (
                                <p key={`t${i}`} className="text-xs text-muted-foreground">
                                  {[s.book, pagesText(s.pages), s.where].filter(Boolean).join(" · ")} · in the book’s own keyword list
                                  {s.line && <span className="block text-sm leading-relaxed">{s.line}</span>}
                                </p>
                              ))}
                            {k.itemIds.length > 0 && !k.itemIds.every((i) => lines[i]) && <p className="text-xs text-muted-foreground">Loading the lines…</p>}
                            {loaded.map((l, i) => (
                              <div key={i}>
                                <p className="leading-relaxed text-muted-foreground">{l.quote}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  — {[[l.book, l.author].filter(Boolean).join(", "), l.where, pagesText(l.pages)].filter(Boolean).join(" · ")}
                                  {l.phrase ? ` · from “${l.phrase}”` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {(passages.length > 0 || kind) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Passages filed here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {passages.length.toLocaleString()} passage{passages.length === 1 ? "" : "s"}
            {silo.passagesMore > 0 && !book && !kind ? ` (and ${silo.passagesMore.toLocaleString()} more not listed)` : ""}, by kind of reading: general teaching and natal first, then synastry, transit, progression, worked examples
            and the rest. Each shows the book, the section it sits in and the page. Open one to read it.
          </p>
          <ul className="mt-3 divide-y divide-border/60 rounded-xl border border-border">
            {passages.slice(0, shown).map((p, i) => {
              const context = p.itemId ? lines[p.itemId]?.[0]?.context : null;
              const group = readingGroup(p.kind);
              const first = i === 0 || readingGroup(passages[i - 1].kind) !== group;
              const about = [p.role ? label(ROLE_LABEL, p.role) : null, ORIGIN_LABEL[p.origin] || null].filter(Boolean).join(" · ");
              const full = p.textId ? bodies[p.textId] : null;
              return (
                <li key={p.id} className="px-3 py-2">
                  {first && (
                    <p className="-mx-3 -mt-2 mb-2 border-b border-border/60 bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {READING_GROUPS.find((g) => g.key === group)!.label} <span className="tabular-nums">· {passages.filter((x) => readingGroup(x.kind) === group).length}</span>
                    </p>
                  )}
                  <details
                    onToggle={(e) => {
                      if (!(e.target as HTMLDetailsElement).open) return;
                      if (p.itemId) loadContext(p.itemId);
                      if (p.textId) loadBody(p.textId);
                    }}
                  >
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{[p.book, p.author].filter(Boolean).join(", ")}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {[p.section, p.where, pagesText(p.pages)].filter(Boolean).join(" · ") || "no section given"}
                      </span>{" "}
                      <span className={cn("rounded-full border px-1.5 text-[10px]", group === "general" || group === "natal" ? "border-primary/50 text-primary" : group === "unknown" ? "border-dashed border-border text-muted-foreground" : "border-gold text-foreground")}>
                        {p.kind ? readingLabel(p.kind) : "kind not known yet"}
                      </span>
                      <span className="block pl-4 text-xs text-muted-foreground">
                        {about ? `${about} — ` : ""}
                        {p.text.slice(0, 110)}
                        {p.text.length > 110 ? "…" : ""}
                      </span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line border-l-2 border-gold/60 pl-3 text-sm leading-relaxed">{full ?? p.text}</p>
                    {p.textId && !full && <p className="mt-1 text-xs text-muted-foreground">Loading the rest…</p>}
                    {context && context !== p.text && <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Around it: {context}</p>}
                  </details>
                  <div className="flex flex-wrap justify-end">
                    <LibraryNote
                      targetType={p.origin === "book section" ? "section" : "passage"}
                      targetId={p.id}
                      silo={here}
                      context={`${silo.label}: ${[p.book, p.author, p.section ?? p.where, pagesText(p.pages)].filter(Boolean).join(", ")}: “${short(p.text)}”`}
                      note={notes[`${p.origin === "book section" ? "section" : "passage"}|${p.id}`]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {passages.length > shown && (
            <button type="button" onClick={() => setShown(shown + 200)} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60">
              Show more ({(passages.length - shown).toLocaleString()} left)
            </button>
          )}
        </section>
      )}

      {facts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">What each book gives for it</h2>
          <p className="mt-1 text-sm text-muted-foreground">Correspondences and descriptions, each with its book. Hover a value to see the book’s own remark, where there is one.</p>
          <dl className="mt-3 divide-y divide-border/60 rounded-xl border border-border text-sm">
            {facts.map((f) => (
              <div key={f.category} className="grid gap-1 px-3 py-2 sm:grid-cols-[11rem_1fr]">
                <dt className="font-medium">{f.category}</dt>
                <dd className="space-y-1">
                  {f.values.map((v, i) => (
                    <div key={i} className="flex flex-wrap items-start gap-x-1">
                      <div className="min-w-0 flex-1">
                      <span title={v.note ?? undefined} className={cn(v.note && "underline decoration-dotted underline-offset-2")}>
                        {v.value}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        — {[v.book, v.page ? `p. ${v.page}` : null, v.scheme, v.facet ? FACET_HEADING[v.facet] : null].filter(Boolean).join(" · ")}
                      </span>
                      {v.note && v.value.length < 90 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">the book’s remark</summary>
                          {v.note}
                        </details>
                      )}
                      </div>
                      <LibraryNote
                        targetType="correspondence"
                        targetId={v.id}
                        silo={here}
                        context={`${silo.label}, ${f.category}: ${short(v.value)} (${[v.book, v.page ? `p. ${v.page}` : null].filter(Boolean).join(", ")})`}
                        note={notes[`correspondence|${v.id}`]}
                      />
                    </div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

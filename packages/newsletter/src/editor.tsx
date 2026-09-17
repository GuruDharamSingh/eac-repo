"use client";

import { useEffect, useRef, useState } from "react";
import { STARTER_LETTERS, renderStarter } from "./starters";
import {
  threadCardMarkup,
  shapeForKind,
  registerEacEmailBlocks,
  DARK_BLOCK_PALETTE,
  LIGHT_BLOCK_PALETTE,
  type BlockPalette,
} from "./blocks";

/**
 * The newsletter editor: GrapesJS with its newsletter preset.
 *
 * Why not the Silex editor — the reason this package exists at all: the
 * preset rebuilds the editor around EMAIL. Tables instead of flex, a fixed
 * ~600px body, no script, and CSS inlined on export, because that is what
 * mail clients render. Those settings are wrong for a web page, and a Silex
 * project saved with them loaded would be rewritten into an email.
 *
 * GrapesJS is imported dynamically. It touches `document` at module scope, so
 * a static import breaks the server render of any page that mounts this.
 *
 * Save produces TWO artefacts, both stored: the project JSON (so the letter
 * can be reopened and edited) and the inlined HTML (so it can be sent without
 * an editor present — `juice`, which does the inlining, runs in the browser
 * as part of the preset).
 */
export function NewsletterEditor({
  slug,
  title: initialTitle,
  project,
  saveEndpoint,
  sendEndpoint,
  recipientCount,
  testAddress,
  mode = "newsletter",
  theme = "dark",
  subjectLabel,
  seedHtml,
  envelope,
  letterBlocks = [],
  fields = [],
  threads = [],
  palette: hostPalette,
}: {
  slug: string;
  title: string;
  project: unknown;
  saveEndpoint: string;
  sendEndpoint: string;
  /** How many contacts a real send would reach, for the confirmation. */
  recipientCount: number;
  /** The signed-in editor's own address, prefilled for a test send. */
  testAddress: string;
  /**
   * "newsletter" is a letter you write once and send to a list.
   * "template" is the body of an automatic email — a welcome, an RSVP
   * confirmation — which is never blasted to anyone, so it offers Save and a
   * test send and deliberately has NO "send to everyone" button. Handing
   * someone a button that would mail an RSVP confirmation to the whole
   * contact list is the kind of mistake you only get to make once.
   */
  mode?: "newsletter" | "template";
  /** Match the palette of the suite this will sit alongside. */
  theme?: "dark" | "light";
  /** "Subject" for a newsletter; a template's subject is set by the sender. */
  subjectLabel?: string;
  /**
   * What to open on when nothing has been saved yet.
   *
   * "Lay it out yourself" used to open an empty canvas: the page passed
   * `project ?? null` and the letter you had just clicked never reached the
   * editor, so every org rebuilt from memory a design it was looking at one
   * click earlier. This is that letter's body, with `{field}` slots where the
   * per-recipient values go.
   *
   * Only used when `project` is absent — a saved layout always wins, or a
   * reload would throw away the org's work.
   */
  seedHtml?: string;
  /**
   * The whole letters, as blocks.
   *
   * Rendered on the server (they are React templates) and handed over as
   * markup, so an owner can drop a complete letter onto the canvas — to start
   * over, or to lift the shape of one letter into another.
   */
  letterBlocks?: { id: string; label: string; hint?: string; html: string }[];
  /**
   * The letter AROUND the region being edited.
   *
   * Without it the canvas is a white page: the seed is body-only by design
   * (that is exactly what an org's layout replaces), so there is no card, no
   * 600px column and no dark ground — and the letter's body copy, which is
   * coloured for a dark card, renders close to invisible on white. An editor
   * that does not look like the thing being edited is not doing its job.
   *
   * Drawn into the canvas document OUTSIDE the GrapesJS wrapper, so it is
   * visible, unselectable, and absent from the exported HTML — the send path
   * adds the real header and footer itself, and a copy baked into the body
   * would render twice.
   */
  envelope?: {
    before: string;
    after: string;
    pageColor: string;
    cardColor: string;
  };
  /**
   * The colours to draw blocks in.
   *
   * Passed by a host that knows whose letter this is — derived from the org's
   * own accent via `paletteFor`. Absent falls back to `theme`, which is
   * InnerGathering's navy-and-gold: correct for that app, and exactly what a
   * network-agnostic starter must not assume.
   */
  palette?: BlockPalette;
  /** The `{fields}` this letter may carry, for the reference strip. */
  fields?: { name: string; label: string }[];
  /**
   * This org's threads, for the thread-card picker.
   *
   * Only meaningful in `mode="newsletter"`: a template's thread differs per
   * recipient and its card carries tokens instead, so there is nothing to pick.
   */
  threads?: {
    id: string;
    title: string;
    kind?: string | null;
    when?: string | null;
    where?: string | null;
    summary?: string | null;
    url?: string | null;
    orgName?: string | null;
    coverUrl?: string | null;
    published?: string | null;
  }[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<{
    getProjectData: () => unknown;
    runCommand: (c: string) => unknown;
    destroy: () => void;
    addComponents?: (html: string) => unknown;
    getSelected?: () => { getEl?: () => HTMLElement | null } | null;
  } | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  /** What the server refused a send over, and the send it refused. */
  const [refused, setRefused] = useState<{
    lines: string[];
    retry: () => void;
  } | null>(null);
  /**
   * The card waiting to be linked.
   *
   * Set when an unlinked thread card lands on the canvas, cleared when one is
   * chosen or the picker is dismissed. Holding the GrapesJS component rather
   * than an id because that is what has to be written back into.
   */
  const [picking, setPicking] = useState<{
    /**
     * The card to write into. Null means "there isn't one yet" — the author
     * asked for a thread card from the toolbar, so the choice comes first and
     * the card is built around it.
     */
    getEl: (() => HTMLElement | null) | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let editor: { destroy: () => void } | null = null;

    (async () => {
      const [{ default: grapesjs }, { default: preset }] = await Promise.all([
        import("grapesjs"),
        import("grapesjs-preset-newsletter"),
      ]);
      // @ts-expect-error — grapesjs ships no bundled types for the CSS entry.
      await import("grapesjs/dist/css/grapes.min.css");
      if (cancelled || !host.current) return;

      const palette: BlockPalette =
        hostPalette ?? (theme === "light" ? LIGHT_BLOCK_PALETTE : DARK_BLOCK_PALETTE);

      const instance = grapesjs.init({
        container: host.current,
        height: "100%",
        fromElement: false,
        storageManager: false, // saving is ours, through saveEndpoint
        plugins: [preset],
        pluginsOpts: {
          [preset as unknown as string]: {
            // The whole point: export with styles inlined.
            inlineCss: true,
          },
        },
        // A saved layout wins over the seed, always: the seed is what you get
        // the FIRST time, and letting it win on a reload would silently
        // discard whatever the org had composed.
        ...(project
          ? { projectData: project }
          : seedHtml
            ? { components: seedHtml }
            : {}),
      });

      // The house vocabulary, added alongside the preset's generic blocks so
      // an org lays out its email with the same shapes the network's own
      // templates use rather than reinventing a second visual language.
      registerEacEmailBlocks(instance as never, palette, mode);

      // Starter layouts: a whole letter's worth of blocks in one drop, for an
      // org that would rather adjust something than compose from nothing.
      // Rendered from the same block table the drawer offers, so a starter can
      // never contain a stale copy of a block that has since been fixed.
      for (const starter of STARTER_LETTERS) {
        if (starter.only && !starter.only.includes(mode)) continue;
        (instance as never as {
          BlockManager: { add: (id: string, def: Record<string, unknown>) => unknown };
        }).BlockManager.add(`eac-starter-${starter.id}`, {
          label: starter.label,
          category: "Starter layouts",
          attributes: { title: starter.hint },
          content: renderStarter(starter, palette, mode),
        });
      }

      // The letters themselves, above the piece-blocks. These are the "larger
      // blocks" — a whole welcome letter or RSVP confirmation in one drop —
      // which is what the block library was missing: it had the sentences and
      // not the paragraphs.
      for (const letter of letterBlocks) {
        (instance as never as {
          BlockManager: { add: (id: string, def: Record<string, unknown>) => unknown };
        }).BlockManager.add(`eac-letter-${letter.id}`, {
          label: letter.label,
          category: "Whole letters",
          attributes: { title: letter.hint ?? `The ${letter.label} letter, complete.` },
          content: letter.html,
        });
      }

      // Paint the canvas to match, and load the brand faces INTO it. Without
      // this the editor previews every block in a fallback serif and the
      // result looks nothing like what lands in the inbox — which is the one
      // thing a visual editor is for.
      instance.on("load", () => {
        try {
          const doc = (instance as never as {
            Canvas: { getDocument: () => Document };
          }).Canvas.getDocument();

          const page = envelope?.pageColor ?? palette.bodyBg;
          const card = envelope?.cardColor ?? palette.cardBg;

          const style = doc.createElement("style");
          style.textContent = `
            @font-face{font-family:'Brothers';src:url('https://elkdonis-arts.org/fonts/BrothersTypeface-Regular.otf') format('opentype');font-display:swap}
            @font-face{font-family:'Basteleur';src:url('https://elkdonis-arts.org/fonts/Basteleur-Moonlight.woff2') format('woff2');font-display:swap}
            @font-face{font-family:'Basteleur';src:url('https://elkdonis-arts.org/fonts/Basteleur-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
            /* !important because the preset ships its own canvas body rule and
               wins on order — without it the card floats on white while the
               real letter sits on near-black, which is the single biggest
               reason the editor did not look like the email. */
            html{background:${page} !important}
            body{background:${page} !important;color:${palette.textBody};font-family:${palette.bodyFont};margin:0 !important;padding:40px 20px !important}
            /* The card. Same 600px column, border and ground the shell draws,
               so what is composed is composed at the width it will be read at
               — a body laid out full-bleed looks nothing like the letter. */
            .eac-nl-card{max-width:600px;margin:0 auto;border:1px solid #b79a55;background:${card}}
            /* The editable region, at the shell's own padding. */
            /* GrapesJS stretches its wrapper to the full canvas height, which
               pushes the footer chrome below the fold and leaves a long empty
               card. The editable region should be as tall as what is in it. */
            [data-gjs-type=wrapper]{background:${card};padding:38px 40px !important;min-height:120px !important;height:auto !important}
            .eac-nl-chrome{pointer-events:none;user-select:none}
            /* What a card is pointed at, on the card. This is the answer to
               "how do I know this references the thread I want" — you read it,
               rather than inferring it from copy you typed yourself. */
            [data-eac-thread-label]{position:relative}
            [data-eac-thread-label]:before{
              content:"\\1F517  " attr(data-eac-thread-label);
              position:absolute;top:-11px;left:8px;z-index:2;
              max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
              font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.04em;
              padding:1px 7px;border:1px solid ${palette.gold};border-radius:2px;
              background:${page};color:${palette.gold}}
            /* And the absence of one, just as loudly. */
            [data-eac-thread=""]:before{
              content:"NOT LINKED TO ANY THREAD";
              position:absolute;top:-11px;left:8px;z-index:2;
              font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;
              padding:1px 7px;border:1px solid #c05a52;border-radius:2px;
              background:${page};color:#e08a8a}
            [data-eac-thread]{position:relative}
            .eac-nl-chrome table{width:100%}
          `;
          doc.head.appendChild(style);

          if (envelope) {
            const wrapper = doc.querySelector("[data-gjs-type=wrapper]");
            if (wrapper?.parentElement) {
              // Wrap the editable region in the card, with the real masthead
              // above and the real footer below. `pointer-events:none` is what
              // keeps them context rather than content — they cannot be
              // selected, dragged or deleted, and GrapesJS never sees them
              // because they are not components.
              const cardEl = doc.createElement("div");
              cardEl.className = "eac-nl-card";
              wrapper.parentElement.insertBefore(cardEl, wrapper);

              const head = doc.createElement("div");
              head.className = "eac-nl-chrome";
              head.innerHTML = envelope.before;
              cardEl.appendChild(head);
              cardEl.appendChild(wrapper);

              if (envelope.after) {
                const foot = doc.createElement("div");
                foot.className = "eac-nl-chrome";
                foot.innerHTML = envelope.after;
                cardEl.appendChild(foot);
              }
            }
          }
        } catch {
          // A canvas we cannot reach is a cosmetic loss, not a broken editor.
        }
      });

      // An unlinked thread card asks which thread it is, the moment it lands.
      // Doing it on drop rather than offering a separate "link" action is what
      // makes the answer to "is this pointing at the right thing" unavoidable
      // instead of something an author has to remember to check.
      if (mode === "newsletter" && threads.length > 0) {
        (instance as never as {
          on: (ev: string, fn: (c: unknown) => void) => void;
        }).on("component:add", (component) => {
          const comp = component as {
            getEl?: () => HTMLElement | null;
            view?: { el?: HTMLElement };
          };
          const el = comp.getEl?.() ?? comp.view?.el ?? null;
          if (!el) return;
          const card =
            el.getAttribute?.("data-eac-thread") === ""
              ? el
              : el.querySelector?.('[data-eac-thread=""]') ?? null;
          if (!card) return;
          setPicking({ getEl: () => (card as HTMLElement) ?? null });
        });
      }

      editor = instance as unknown as { destroy: () => void };
      editorRef.current = instance as never;
      instance.on("update", () => setDirty(true));
      if (!cancelled) setReady(true);
    })().catch((err) => {
      console.error("[newsletter] editor failed to start", err);
      if (!cancelled) setStatus("The editor failed to load.");
    });

    return () => {
      cancelled = true;
      try { editor?.destroy(); } catch { /* already gone */ }
    };
    // Mount once: re-running would discard in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Leaving with unsaved work is the worst thing an editor can do to someone. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(): Promise<boolean> {
    const editor = editorRef.current;
    if (!editor) return false;
    setBusy("save");
    setStatus(null);
    try {
      // The preset's own command — it runs juice and hands back the document
      // with every rule inlined.
      const html = String(editor.runCommand("gjs-get-inlined-html") ?? "");
      const res = await fetch(saveEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), project: editor.getProjectData(), html }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.error ?? "Could not save.");
        return false;
      }
      setDirty(false);
      setStatus("Saved.");
      return true;
    } catch {
      setStatus("Could not reach the server.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function send(test: boolean, force = false) {
    // Always save first: the send path reads the STORED html, so sending
    // without saving would post the previous draft.
    if (!(await save())) return;

    if (!test) {
      const ok = window.confirm(
        `Send "${title.trim() || slug}" to ${recipientCount} ` +
          `${recipientCount === 1 ? "person" : "people"}? This cannot be undone.`
      );
      if (!ok) return;
    }

    setBusy(test ? "test" : "send");
    setStatus(null);
    try {
      const res = await fetch(sendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test ? { testTo: [testAddress] } : { force }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        // A refusal is different from a failure: the server checked the letter
        // and found something the author can fix. Listing each problem and
        // offering to override beats a one-line error they have to decode.
        const problems = data.problems as
          | { brokenLinks: { label: string | null }[]; placeholders: string[] }
          | undefined;
        if (problems) {
          setRefused({
            lines: [
              ...problems.brokenLinks.map(
                (b) =>
                  `A card points at a thread that is no longer published${b.label ? ` — ${b.label}` : ""}.`
              ),
              ...problems.placeholders.map((p) => `${p[0].toUpperCase()}${p.slice(1)}.`),
            ],
            retry: () => {
              setRefused(null);
              void send(false, true);
            },
          });
          return;
        }
        setStatus(data.error ?? "Could not send.");
        return;
      }
      setStatus(
        test
          ? `Test sent to ${testAddress}.`
          : `Sent to ${data.sent}${data.failed ? `, ${data.failed} failed` : ""}.`
      );
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Write a chosen thread into a card.
   *
   * Only the marked slots are touched, so an author who has already reworded
   * the link text or deleted the summary line keeps their edit. The id and the
   * label are what the send path and the badge read.
   */
  function linkThread(thread: (typeof threads)[number]) {
    const el = picking?.getEl?.() ?? null;
    setPicking(null);

    // Asked for from the toolbar: there is no card yet, so make one already
    // linked. Inserting an unlinked card and immediately filling it would
    // bounce the picker straight back open.
    if (!el) {
      editorRef.current?.addComponents?.(threadCardHtml(thread));
      setDirty(true);
      return;
    }

    // A gathering card re-pointed at a blog post is the wrong shape, not a
    // stale one: it would carry empty when/where lines and no cover. Swap the
    // whole card in that case; fill in place when the shape is unchanged, so
    // an author who reworded the link text keeps their edit.
    //
    // Only the two KIND-DERIVED shapes swap. A lead feature and an agenda row
    // are presentations the author chose — someone who put a workshop in the
    // lead slot meant to, and silently turning it into a compact gathering
    // card would be overruling them.
    const current = el.getAttribute("data-eac-shape");
    const wanted = shapeForKind(thread.kind);
    const kindDerived = current === "gathering" || current === "writing";
    if (kindDerived && current !== wanted) {
      el.outerHTML = threadCardHtml(thread);
      setDirty(true);
      return;
    }

    el.setAttribute("data-eac-thread", thread.id);
    el.setAttribute(
      "data-eac-thread-label",
      [thread.title, thread.kind, thread.when ?? thread.published].filter(Boolean).join(" · ")
    );

    const put = (field: string, value: string) => {
      const slot = el.querySelector(`[data-eac-thread-field="${field}"]`);
      if (slot) slot.textContent = value;
    };
    put("kind", [thread.kind, thread.orgName].filter(Boolean).join(" · "));
    put("title", thread.title);
    put("summary", thread.summary ?? "");
    put("when", thread.when ?? "");
    put("where", thread.where ?? "");
    put("date", thread.published ?? thread.when ?? "");
    const link = el.querySelector('[data-eac-thread-field="url"]');
    if (link && thread.url) link.setAttribute("href", thread.url);
    const cover = el.querySelector('[data-eac-thread-field="cover"]');
    if (cover) {
      if (thread.coverUrl) cover.setAttribute("src", thread.coverUrl);
      else cover.remove();
    }

    setDirty(true);
  }

  /**
   * A card that is linked from the moment it appears, in the shape its kind
   * deserves — a workshop gets when-and-where, a post gets a cover and a
   * standfirst. Built by the same function the blocks use, so the field
   * markers the send-time resolver looks for cannot drift.
   */
  function threadCardHtml(thread: (typeof threads)[number]): string {
    return threadCardMarkup(thread, theme === "light" ? LIGHT_BLOCK_PALETTE : DARK_BLOCK_PALETTE);
  }

  return (
    <div className="eac-nl">
      <header className="eac-nl-bar">
        <label className="eac-nl-subject">
          <span>{subjectLabel ?? (mode === "template" ? "Name" : "Subject")}</span>
          <input
            value={title}
            maxLength={200}
            placeholder={mode === "template" ? "What this template is for" : "What this letter is about"}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          />
        </label>

        <div className="eac-nl-actions">
          {mode === "newsletter" && threads.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // A card is already selected — re-point that one. Otherwise
                // make a new one. Without this there was no way to change a
                // card's thread, or to link one after dismissing the picker.
                const sel = editorRef.current?.getSelected?.() ?? null;
                const el = sel?.getEl?.() ?? null;
                const card =
                  el?.getAttribute?.("data-eac-thread") !== null && el
                    ? el
                    : (el?.closest?.("[data-eac-thread]") as HTMLElement | null) ?? null;
                setPicking({ getEl: card ? () => card : null });
              }}
              disabled={!ready || Boolean(busy)}
            >
              Thread card…
            </button>
          )}
          {status && <span className="eac-nl-status">{status}</span>}
          {dirty && !status && <span className="eac-nl-status">Unsaved changes</span>}
          <button type="button" onClick={() => void save()} disabled={!ready || Boolean(busy)}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => void send(true)} disabled={!ready || Boolean(busy)}>
            {busy === "test" ? "Sending…" : "Send test to me"}
          </button>
          {mode === "newsletter" && (
            <button
              type="button"
              className="eac-nl-primary"
              onClick={() => void send(false)}
              disabled={!ready || Boolean(busy) || recipientCount === 0}
              title={recipientCount === 0 ? "This org has no contacts to send to" : undefined}
            >
              {busy === "send" ? "Sending…" : `Send to ${recipientCount}`}
            </button>
          )}
        </div>
      </header>

      {/*
        What this letter can say.

        Without it, `{guestName}` is a syntax an owner has to be told about
        somewhere else and then remember. The strip is reference, not magic:
        clicking copies the token so it can be pasted into any text block,
        which works with the editor's own inline editing instead of fighting
        it for cursor position.
      */}
      {refused && (
        <div className="eac-nl-picker" role="dialog" aria-modal="true" aria-label="Not sent">
          <div className="eac-nl-picker-panel">
            <h2>Not sent</h2>
            <p>This letter still has something unfinished in it.</p>
            <ul className="eac-nl-problems">
              {refused.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="eac-nl-picker-buttons">
              <button type="button" onClick={() => setRefused(null)}>
                Go back and fix
              </button>
              <button type="button" className="eac-nl-danger" onClick={refused.retry}>
                Send anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {picking && (
        <div
          className="eac-nl-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Which thread is this card for?"
        >
          <div className="eac-nl-picker-panel">
            <h2>Which one is this card for?</h2>
            <p>
              The card stays pointed at it. Whatever the details are when you
              send is what goes out.
            </p>
            {(() => {
              // Grouped by what the thing IS, because that is also what
              // decides the card's shape — choosing from a flat list makes the
              // shape a surprise rather than a decision.
              const groups = new Map<string, typeof threads>();
              for (const t of threads) {
                const g = shapeForKind(t.kind) === "gathering" ? "Gatherings" : "Writing";
                groups.set(g, [...(groups.get(g) ?? []), t]);
              }
              return [...groups.entries()].map(([group, items]) => (
                <section key={group}>
                  <h3 className="eac-nl-picker-group">
                    {group}
                    <span>
                      {group === "Gatherings"
                        ? "shown with when and where"
                        : "shown with a cover and a standfirst"}
                    </span>
                  </h3>
                  <ul>
                    {items.map((thread) => (
                      <li key={thread.id}>
                        <button type="button" onClick={() => linkThread(thread)}>
                          <b>{thread.title}</b>
                          <span>
                            {[thread.kind, thread.when ?? thread.published, thread.where]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ));
            })()}

            <button
              type="button"
              className="eac-nl-picker-skip"
              onClick={() => setPicking(null)}
            >
              Leave it unlinked for now
            </button>
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <div className="eac-nl-fields">
          <span className="eac-nl-fields-label">Fills in when it sends</span>
          {fields.map((field) => (
            <button
              key={field.name}
              type="button"
              className="eac-nl-chip"
              title={`${field.label} — click to copy`}
              onClick={() => {
                void navigator.clipboard?.writeText(`{${field.name}}`).then(
                  () => {
                    setCopied(field.name);
                    window.setTimeout(
                      () => setCopied((c) => (c === field.name ? null : c)),
                      1400
                    );
                  },
                  () => setCopied(null)
                );
              }}
            >
              {copied === field.name ? "copied" : `{${field.name}}`}
            </button>
          ))}
        </div>
      )}

      <div className="eac-nl-canvas" ref={host} />
      {!ready && <p className="eac-nl-loading">Loading the editor…</p>}
    </div>
  );
}

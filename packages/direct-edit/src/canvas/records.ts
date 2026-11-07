// ============================================================================
// "From what?" (2026-11-06): one chooser for every block prop that holds a
// reference to a record (a prop declared `binds: "<kind>"`). Step one lists
// where a choice can come from (this site's people, a tour, a series); step two
// lists what that source has, as the platform stores it, including choices that
// follow the record ("host of the next session"). The host supplies the lists
// and what a value draws; this module draws the two steps in the editor's
// drawer. Plain DOM; the editor never stores what a value resolved to.
// ============================================================================

export interface RecordSourceItem {
  /** Passed back to `choices`. */
  ref: string;
  label: string;
  hint?: string;
}

export interface RecordChoice {
  /** What the page stores. */
  value: string;
  label: string;
  hint?: string;
  /** Changes by itself as the record changes. */
  follows?: boolean;
  /** Shown, so an owner sees why someone is missing; cannot be chosen. */
  disabled?: boolean;
}

export interface RecordSources {
  /** Whether this host can choose values of this kind. Others keep a text field. */
  handles(binds: string): boolean;
  sources(binds: string): Promise<RecordSourceItem[]>;
  choices(binds: string, source: string): Promise<RecordChoice[]>;
  /** What the block draws for a value, by prop name (never stored); null when nothing would be drawn. */
  resolve(binds: string, value: string): Promise<Record<string, unknown> | null>;
  /** Words for the current choice in the side panel. `drawn` is what `resolve` gave, when known. */
  describe(binds: string, value: string, drawn: Record<string, unknown> | null | undefined): string;
  /** The drawer's title. Default: "Choose". */
  title?(binds: string): string;
  /** The words of the link that clears the choice. Default: "Clear the choice". */
  clearLabel?(binds: string): string;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/**
 * Draws the two steps in `body`. `onPick` gets the chosen value ("" to clear).
 * Returns the cleanup the drawer calls when it closes.
 */
export function mountRecordChooser(body: HTMLElement, o: { records: RecordSources; binds: string; value: string; onPick(value: string): void | Promise<void> }): () => void {
  let gone = false;
  let sources: RecordSourceItem[] | null = null;
  let filter = "";

  const row = (attrs: string, label: string, hint?: string, extra = "") =>
    `<li><button type="button" class="de-rec-row" ${attrs}><span class="de-rec-label">${esc(label)}${extra}</span>${hint ? `<span class="de-rec-hint">${esc(hint)}</span>` : ""}</button></li>`;

  function drawSources() {
    if (gone) return;
    const list = (sources ?? []).filter((s) => !filter || `${s.label} ${s.hint ?? ""}`.toLowerCase().includes(filter));
    const clear = o.value ? `<p><button type="button" class="de-rec-link" data-rec-clear="" data-f="rec-clear">${esc(o.records.clearLabel?.(o.binds) ?? "Clear the choice")}</button></p>` : "";
    body.innerHTML =
      `<p class="de-note">From what?</p>` +
      `<input type="search" class="de-rec-filter" data-f="rec-filter" placeholder="Filter" value="${esc(filter)}" aria-label="Filter">` +
      (sources === null ? `<p class="de-note">Loading…</p>` : list.length ? `<ul class="de-rec-list" data-f="rec-sources">${list.map((s) => row(`data-rec-source="${esc(s.ref)}"`, s.label, s.hint)).join("")}</ul>` : `<p class="de-note">Nothing matches.</p>`) +
      clear;
    const input = body.querySelector<HTMLInputElement>(".de-rec-filter");
    if (input && filter) { input.focus(); input.setSelectionRange(filter.length, filter.length); }
  }

  async function drawChoices(source: RecordSourceItem) {
    body.innerHTML = `<p><button type="button" class="de-rec-link" data-rec-back="" data-f="rec-back">‹ From what?</button></p><p class="de-rec-from"><b>${esc(source.label)}</b></p><p class="de-note">Loading…</p>`;
    let list: RecordChoice[] = [];
    try { list = await o.records.choices(o.binds, source.ref); } catch { list = []; }
    if (gone) return;
    const follows = list.filter((c) => c.follows), fixed = list.filter((c) => !c.follows);
    const draw = (c: RecordChoice) => row(`data-rec-value="${esc(c.value)}"${c.disabled ? " disabled" : ""}${c.value === o.value ? ' aria-current="true"' : ""}`, c.label, c.hint, c.value === o.value ? " ✓" : "");
    body.querySelector(".de-note")!.outerHTML =
      (follows.length ? `<p class="de-note">Follows it as it changes</p><ul class="de-rec-list" data-f="rec-follows">${follows.map(draw).join("")}</ul>` : "") +
      (fixed.length ? `<p class="de-note">${follows.length ? "Or always this person" : "Choose"}</p><ul class="de-rec-list" data-f="rec-fixed">${fixed.map(draw).join("")}</ul>` : "") +
      (!list.length ? `<p class="de-note">No one is stored on this yet.</p>` : "");
  }

  const onClick = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement;
    const src = t.closest<HTMLElement>("[data-rec-source]")?.dataset.recSource;
    if (src !== undefined) { const s = sources?.find((x) => x.ref === src); if (s) void drawChoices(s); return; }
    if (t.closest("[data-rec-back]")) { drawSources(); return; }
    if (t.closest("[data-rec-clear]")) { void o.onPick(""); return; }
    const b = t.closest<HTMLButtonElement>("[data-rec-value]");
    if (b && !b.disabled) void o.onPick(b.dataset.recValue!);
  };
  const onInput = (ev: Event) => {
    const t = ev.target as HTMLInputElement;
    if (!t.classList.contains("de-rec-filter")) return;
    filter = t.value.trim().toLowerCase();
    drawSources();
  };
  body.addEventListener("click", onClick);
  body.addEventListener("input", onInput);
  drawSources();
  o.records.sources(o.binds).then((s) => { sources = s; drawSources(); }, () => { sources = []; drawSources(); });
  return () => {
    gone = true;
    body.removeEventListener("click", onClick);
    body.removeEventListener("input", onInput);
  };
}

/**
 * What the editor holds for bound props: the host's lists, and what each value drew, by block type, prop and value.
 * Kept beside the document, never in it, and looked up by value, so undo and the popup's discard draw the right record.
 */
export interface Binding {
  records: RecordSources;
  /** undefined: not fetched yet; null: fetched, draws nothing. */
  drawn(type: string, prop: string, value: string): Record<string, unknown> | null | undefined;
  remember(type: string, prop: string, value: string, drawn: Record<string, unknown> | null): void;
}

/**
 * The binding engine.
 *
 * Parses the template HTML once, walks the declared bindings, and writes
 * resolved context values into the matching elements.
 *
 * ── Why a parser and not regex ───────────────────────────────────────────────
 * The previous renderer matched `data-trait` with regular expressions and had to
 * carry the caveat "avoid for divs with nested divs at the same depth", because
 * `<div data-trait="x">…<div/>…</div>` cannot be matched by a regex. It also
 * hand-built entire `<section>` blocks in TypeScript for the schedule and
 * gallery, which put page design in a string builder. A real parse removes both
 * problems: nesting is exact, and repeated markup is cloned from the template
 * file where a designer can still see it.
 *
 * Round-tripping is byte-identical for untouched markup, so published pages —
 * including `<style>` blocks and `<eac-embed>` placeholders — pass through
 * unchanged.
 */

import { parse, type HTMLElement } from "node-html-parser";
import type {
  ApplyOptions,
  Binding,
  BindingMap,
  FormatterMap,
  ListBinding,
} from "./types";
import { builtinFormatters } from "./formatters";
import { isEmptyValue, resolvePath, toDisplayString } from "./path";

/** Keeps `<style>`/`<script>`/`<pre>` bodies raw so their contents survive. */
const PARSE_OPTIONS = {
  blockTextElements: { script: true, noscript: true, style: true, pre: true },
} as const;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

/**
 * Elements carrying `trait`, including `root` itself.
 *
 * Both attributes are honoured: `data-href-trait` predates this engine and is
 * still present in shipped templates, where it marks an anchor whose `href` is
 * bound while its text is bound separately.
 */
function findTargets(root: HTMLElement, trait: string): HTMLElement[] {
  const escaped = trait.replace(/"/g, '\\"');
  const selector = `[data-trait="${escaped}"], [data-href-trait="${escaped}"]`;
  const found = root.querySelectorAll(selector);
  const self =
    root.getAttribute?.("data-trait") === trait ||
    root.getAttribute?.("data-href-trait") === trait
      ? [root]
      : [];
  return [...self, ...found];
}

/** Resolve a binding's `from` paths to raw context values. */
function resolveValues(binding: Binding, context: unknown): unknown[] {
  if (binding.from === undefined) return [];
  const paths = Array.isArray(binding.from) ? binding.from : [binding.from];
  return paths.map((path) => resolvePath(context, path));
}

/**
 * Turn raw values into the final display string: format (or join), then
 * `template`, then `fallback`.
 */
function computeValue(
  trait: string,
  binding: Binding,
  values: unknown[],
  formatters: FormatterMap,
  warn: (message: string) => void
): string {
  let out: string;

  if (binding.format) {
    const formatter = formatters[binding.format];
    if (!formatter) {
      warn(`binding "${trait}": unknown formatter "${binding.format}"`);
      out = toDisplayString(values[0]);
    } else {
      out = formatter(...values);
    }
  } else {
    out = values
      .map(toDisplayString)
      .filter((part) => part.trim() !== "")
      .join(binding.join ?? " ");
  }

  if (out !== "" && binding.template) {
    out = binding.template.replace("{}", out);
  }
  if (out.trim() === "" && binding.fallback !== undefined) {
    out = binding.fallback;
  }
  return out;
}

/** Merge one declaration into an existing inline `style` attribute. */
function setStyleProp(el: HTMLElement, prop: string, value: string): void {
  const existing = el.getAttribute("style") ?? "";
  const decls = existing
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "" && d.split(":")[0]?.trim() !== prop);
  decls.push(`${prop}:${value}`);
  el.setAttribute("style", decls.join(";"));
}

/**
 * Templates ship optional lines with a `hidden` attribute so the unbound file
 * still previews cleanly. Filling one in must also reveal it.
 */
function unhide(el: HTMLElement): void {
  if (el.hasAttribute("hidden")) el.removeAttribute("hidden");
}

function applyList(
  container: HTMLElement,
  binding: ListBinding,
  context: unknown,
  formatters: FormatterMap,
  warn: (message: string) => void
): void {
  const raw = resolveValues(binding, context)[0];
  const items = Array.isArray(raw) ? raw : [];
  const limited = binding.limit ? items.slice(0, binding.limit) : items;

  if (limited.length === 0) {
    if ((binding.whenEmpty ?? "remove") === "remove") container.remove();
    return;
  }

  const itemTemplate = container.childNodes.find(
    (node): node is HTMLElement => node instanceof Object && "tagName" in node
  );
  if (!itemTemplate) {
    warn(`list binding: container has no element child to use as an item template`);
    return;
  }

  const rendered = limited.map((item, index) => {
    const clone = itemTemplate.clone() as HTMLElement;
    applyBindingMap(clone, binding.item, { ...(context as object), item, index }, formatters, warn);
    if (index === 0 && binding.firstClass) clone.classList.add(binding.firstClass);
    return clone.toString();
  });

  container.set_content(rendered.join(""));
  unhide(container);
}

function applyToElement(
  el: HTMLElement,
  trait: string,
  binding: Binding,
  context: unknown,
  formatters: FormatterMap,
  warn: (message: string) => void
): void {
  if (binding.kind === "list") {
    applyList(el, binding, context, formatters, warn);
    return;
  }

  const values = resolveValues(binding, context);

  if (binding.kind === "show") {
    // With several `from` paths, "present" means any of them has a value — a
    // section that renders when it has images OR a video, say.
    const present = values.some((value) => !isEmptyValue(value));
    const keep = binding.unless ? !present : present;
    if (keep) unhide(el);
    else el.remove();
    return;
  }

  const value = computeValue(trait, binding, values, formatters, warn);

  if (value.trim() === "") {
    if (binding.omitWhenEmpty) el.remove();
    return;
  }

  switch (binding.kind) {
    case "text":
      el.set_content(escapeHtml(value));
      unhide(el);
      break;
    case "html":
      // Not sanitized here — the caller's pipeline owns that. See HtmlBinding.
      el.set_content(value);
      unhide(el);
      break;
    case "attr":
      el.setAttribute(binding.attr, value);
      unhide(el);
      break;
    case "style":
      setStyleProp(el, binding.prop, value);
      unhide(el);
      break;
    case "class":
      el.classList.add(binding.class);
      break;
  }
}

function applyBindingMap(
  root: HTMLElement,
  bindings: BindingMap,
  context: unknown,
  formatters: FormatterMap,
  warn: (message: string) => void
): void {
  for (const [trait, declared] of Object.entries(bindings)) {
    const targets = findTargets(root, trait);
    if (targets.length === 0) continue;
    const list = Array.isArray(declared) ? declared : [declared];
    for (const el of targets) {
      for (const binding of list) {
        // A prior binding in the list may have removed the element
        // (omitWhenEmpty / show); stop touching it if so.
        if (!el.parentNode) break;
        applyToElement(el, trait, binding, context, formatters, warn);
      }
    }
  }
}

/**
 * Apply `bindings` to `html` using values from `context`.
 *
 * Returns the bound HTML. Traits with no matching element and elements with no
 * matching binding are both left alone — a template and its data can be
 * versioned independently, and `validateBindings` is where mismatches are
 * reported rather than at render time.
 */
export function applyBindings(
  html: string,
  bindings: BindingMap,
  context: unknown,
  options: ApplyOptions = {}
): string {
  if (!html || Object.keys(bindings).length === 0) return html;

  const formatters = { ...builtinFormatters, ...(options.formatters ?? {}) };
  const warn =
    options.onWarn ??
    ((message: string) => console.warn(`[cms-bindings] ${message}`));

  const root = parse(html, PARSE_OPTIONS);
  applyBindingMap(root, bindings, context, formatters, warn);
  return root.toString();
}

/**
 * Apply the bindings of every section in a manifest to one document.
 *
 * Bindings are scoped to their own section rather than merged into one map,
 * because trait names are only unique *within* a section. `ctaLabel` exists in
 * the workshop nav, hero and registration block and means something different in
 * each — a merged map would let whichever section came last overwrite the other
 * two. Sections are located by the `data-gjs-type="<section id>"` attribute
 * every template root carries, falling back to a class of the same name.
 *
 * A section absent from the page is skipped, so this is safe on a page the owner
 * has partly rearranged in the editor.
 */
export function applyManifestBindings(
  html: string,
  sections: { id: string; bindings?: BindingMap }[],
  context: unknown,
  options: ApplyOptions = {}
): string {
  if (!html) return html;
  const bound = sections.filter((section) => section.bindings);
  if (bound.length === 0) return html;

  const formatters = { ...builtinFormatters, ...(options.formatters ?? {}) };
  const warn =
    options.onWarn ??
    ((message: string) => console.warn(`[cms-bindings] ${message}`));

  const root = parse(html, PARSE_OPTIONS);

  for (const section of bound) {
    const escaped = section.id.replace(/"/g, '\\"');
    let scopes = root.querySelectorAll(`[data-gjs-type="${escaped}"]`);
    if (scopes.length === 0) scopes = root.querySelectorAll(`.${section.id}`);
    for (const scope of scopes) {
      applyBindingMap(scope, section.bindings!, context, formatters, warn);
    }
  }

  return root.toString();
}

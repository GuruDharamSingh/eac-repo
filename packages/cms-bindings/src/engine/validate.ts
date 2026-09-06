/**
 * Cross-checks between a template's three declarations.
 *
 * A section declares hooks in its HTML (`data-trait`), data in its manifest
 * (`cmsFields`), and the edge between them (`bindings`). Nothing stops those
 * drifting apart, and they did: the workshop manifest still carries a note about
 * a `threads.tags` field that was listed for months without a matching column.
 *
 * These checks turn that class of drift into a build failure instead of a
 * silently blank line on a published page. Run from
 * `pnpm --filter @elkdonis/cms-bindings audit:template`.
 */

import { parse } from "node-html-parser";
import type { BindingMap, FormatterMap } from "./types";
import { builtinFormatters } from "./formatters";
import { resolvePath } from "./path";

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  sectionId: string;
  trait?: string;
  message: string;
}

export interface SectionToValidate {
  id: string;
  /** The section's HTML, already read from disk. */
  html: string;
  bindings?: BindingMap;
  /** The manifest's `traits` list, kept for back-compat with the live editor. */
  traits?: string[];
}

export interface ValidateOptions {
  formatters?: FormatterMap;
  /**
   * A representative context. When given, every binding's `from` paths are
   * resolved against it and unreachable paths are reported — this is what
   * catches a renamed column before it reaches a page.
   */
  sampleContext?: unknown;
  /** Traits bound by something other than the manifest (e.g. live-editor only). */
  ignoreTraits?: string[];
}

/** Every `data-trait` / `data-href-trait` value present in a fragment. */
export function extractTraitNames(html: string): Set<string> {
  const root = parse(html, {
    blockTextElements: { script: true, noscript: true, style: true, pre: true },
  });
  const traits = new Set<string>();
  for (const el of root.querySelectorAll("[data-trait], [data-href-trait]")) {
    const a = el.getAttribute("data-trait");
    const b = el.getAttribute("data-href-trait");
    if (a) traits.add(a);
    if (b) traits.add(b);
  }
  return traits;
}

/** Trait names referenced anywhere in a binding map, including list items. */
function declaredTraits(bindings: BindingMap): Set<string> {
  const out = new Set<string>();
  for (const [trait, declared] of Object.entries(bindings)) {
    out.add(trait);
    for (const binding of Array.isArray(declared) ? declared : [declared]) {
      if (binding.kind === "list") {
        for (const nested of declaredTraits(binding.item)) out.add(nested);
      }
    }
  }
  return out;
}

function checkBindingMap(
  sectionId: string,
  bindings: BindingMap,
  formatters: FormatterMap,
  options: ValidateOptions,
  issues: ValidationIssue[],
  contextForPaths: unknown,
  insideList: boolean
): void {
  for (const [trait, declared] of Object.entries(bindings)) {
    for (const binding of Array.isArray(declared) ? declared : [declared]) {
      if (binding.format && !formatters[binding.format]) {
        issues.push({
          severity: "error",
          sectionId,
          trait,
          message: `unknown formatter "${binding.format}"`,
        });
      }

      if (binding.kind === "list") {
        // Item paths resolve against `item`, which a flat sample context cannot
        // supply, so only structural checks run inside a list.
        checkBindingMap(sectionId, binding.item, formatters, options, issues, undefined, true);
        continue;
      }

      if (binding.from === undefined) {
        // `fallback` with no `from` is a constant — a fixed label the template
        // shows regardless of data. That is a legitimate declaration, and better
        // than the string literals the old renderer buried in code.
        if (binding.fallback === undefined) {
          issues.push({
            severity: "error",
            sectionId,
            trait,
            message: `binding has neither a "from" path nor a constant "fallback"`,
          });
        }
        continue;
      }

      if (contextForPaths !== undefined && !insideList) {
        const paths = Array.isArray(binding.from) ? binding.from : [binding.from];
        for (const path of paths) {
          if (resolvePath(contextForPaths, path) === undefined) {
            issues.push({
              severity: "warning",
              sectionId,
              trait,
              message: `path "${path}" does not resolve in the sample context`,
            });
          }
        }
      }
    }
  }
}

/**
 * Validate one template's sections.
 *
 * Errors are drift that will definitely misrender (a binding for a hook that
 * does not exist, an unknown formatter). Warnings are things a template may do
 * on purpose (a hook left for the live editor, a path absent from the sample).
 */
export function validateBindings(
  sections: SectionToValidate[],
  options: ValidateOptions = {}
): ValidationIssue[] {
  const formatters = { ...builtinFormatters, ...(options.formatters ?? {}) };
  const ignore = new Set(options.ignoreTraits ?? []);
  const issues: ValidationIssue[] = [];

  for (const section of sections) {
    const inHtml = extractTraitNames(section.html);
    const bindings = section.bindings ?? {};
    const inBindings = declaredTraits(bindings);

    checkBindingMap(
      section.id,
      bindings,
      formatters,
      options,
      issues,
      options.sampleContext,
      false
    );

    for (const trait of inBindings) {
      if (!inHtml.has(trait)) {
        issues.push({
          severity: "error",
          sectionId: section.id,
          trait,
          message: `bound but no [data-trait="${trait}"] in the section HTML`,
        });
      }
    }

    for (const trait of inHtml) {
      if (inBindings.has(trait) || ignore.has(trait)) continue;
      issues.push({
        severity: "warning",
        sectionId: section.id,
        trait,
        message: `hook present in HTML but no binding declares it — it will render its placeholder text`,
      });
    }

    if (section.traits) {
      for (const trait of section.traits) {
        if (!inHtml.has(trait)) {
          issues.push({
            severity: "warning",
            sectionId: section.id,
            trait,
            message: `listed in manifest "traits" but absent from the section HTML`,
          });
        }
      }
    }
  }

  return issues;
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No binding issues.";
  return issues
    .map(
      (i) =>
        `${i.severity === "error" ? "ERROR" : "warn "}  ${i.sectionId}${
          i.trait ? ` · ${i.trait}` : ""
        }: ${i.message}`
    )
    .join("\n");
}

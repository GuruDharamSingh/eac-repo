"use client";

import { useMemo, useState } from "react";
import { importDtcg, linkHooks } from "@elkdonis/tokens";
import type { ImportResult } from "@elkdonis/tokens";
import type { CssVarDef } from "@elkdonis/live-editor";
import type { ThemeVars } from "@elkdonis/services";

/**
 * Bring a design-token file in, instead of typing a palette one row at a time.
 *
 * This sits beside CssPanel rather than replacing it: the panel is for adjusting
 * a colour, this is for arriving with a look already designed somewhere else —
 * Figma, Tokens Studio, a theme someone published. The output is the same bag
 * of {"--name": "value"} the panel edits and site_themes stores, so nothing
 * downstream has to know a file was ever involved.
 *
 * The import itself runs HERE, in the browser. @elkdonis/tokens has no
 * dependencies and touches no database, so a round trip would buy nothing — and
 * doing it locally means someone can paste a file, see exactly what did and did
 * not come across, and change their mind without having written anything.
 */
export function TokenImportPanel({
  orgId,
  pageKey,
  cssVars,
  existing,
  onSave,
  onClose,
}: {
  orgId: string;
  pageKey: string;
  /** The variables THIS app declares — what a hook can be pointed at. */
  cssVars: CssVarDef[];
  /** Whatever this scope already overrides, so an import adds rather than wipes. */
  existing: ThemeVars;
  onSave: (orgId: string, pageKey: string, vars: ThemeVars) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [prefix, setPrefix] = useState("t");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  const importedNames = useMemo(
    () => (result ? Object.keys(result.vars).sort() : []),
    [result]
  );

  function run(raw: string) {
    setSaved(null);
    setParseError(null);
    setResult(null);
    setLinks({});
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // A JSON syntax error is the single most likely failure, and the message
      // says where, so it is worth showing verbatim rather than "invalid file".
      setParseError(err instanceof Error ? err.message : "That is not valid JSON.");
      return;
    }
    setResult(importDtcg(parsed as never, { prefix }));
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    setSaved(null);

    // Turn each chosen variable name back into the token path it came from, so
    // the hooks are built by linkHooks rather than by a second, parallel
    // implementation of the same idea.
    const map: Record<string, string> = {};
    for (const [hook, varName] of Object.entries(links)) {
      const path = result.sources[varName];
      if (path) map[hook] = path;
    }
    const linked = linkHooks(result, map);

    // Existing overrides come first: an import ADDS to what this scope already
    // sets, and only replaces a variable it actually provides a value for.
    const vars = { ...existing, ...result.vars, ...linked.vars };
    const res = await onSave(orgId, pageKey, vars);
    setSaving(false);
    setSaved(res.ok ? `Saved ${Object.keys(vars).length} variables.` : res.error ?? "Could not save.");
  }

  const dropped = result?.counts.dropped ?? 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Import design tokens</h3>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Paste a Design Tokens (DTCG) file — the format Figma, Tokens Studio and
            Style Dictionary export. Nothing is saved until you press Save.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:underline">
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Name prefix</span>
          <input
            id="token-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <p className="max-w-xs text-xs text-muted-foreground">
          Keeps imported names out of the way of this site&apos;s own —
          <code className="ml-1">--{prefix || "…"}-color-brand-primary</code>.
        </p>
        <label className="ml-auto cursor-pointer text-sm underline">
          Choose a file
          <input
            id="token-file"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const raw = await file.text();
              setText(raw);
              run(raw);
            }}
          />
        </label>
      </div>

      <textarea
        id="token-json"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'{\n  "color": {\n    "$type": "color",\n    "brand": { "$value": { "colorSpace": "srgb", "components": [0.4, 0.2, 0.8] } }\n  }\n}'}
        className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
      />

      <button
        type="button"
        onClick={() => run(text)}
        disabled={!text.trim()}
        className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm hover:bg-accent disabled:opacity-50"
      >
        Read the file
      </button>

      {parseError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {parseError}
        </p>
      )}

      {result && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm">
            <strong>{result.counts.vars}</strong> variable{result.counts.vars === 1 ? "" : "s"} read
            {dropped > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowIssues((s) => !s)}
                  className="underline decoration-dotted"
                >
                  {dropped} not carried across
                </button>
              </>
            )}
          </p>

          {/* Never a silent drop: what did not come across, and why. */}
          {showIssues && result.issues.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs">
              {result.issues.map((issue, i) => (
                <li key={i}>
                  <code>{issue.path || "(file)"}</code>{" "}
                  <span className="text-muted-foreground">— {issue.message}</span>
                </li>
              ))}
            </ul>
          )}

          {importedNames.length > 0 && (
            <>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {importedNames.map((name) => (
                      <tr key={name} className="border-b border-border last:border-0">
                        <td className="w-6 p-1 pl-2">
                          {/* A swatch only where a value can actually paint one. */}
                          <span
                            aria-hidden
                            className="block size-4 rounded border border-border"
                            style={{ background: result.vars[name] }}
                          />
                        </td>
                        <td className="p-1 font-mono">{name}</td>
                        <td className="p-1 font-mono text-muted-foreground">{result.vars[name]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-sm font-semibold">Point this site&apos;s colours at them</h4>
                <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                  An imported file names things its own way, so this part is a judgement
                  call rather than something we can guess. Anything left alone keeps its
                  current value.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {cssVars.map((def) => (
                    <label key={def.name} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate text-muted-foreground" title={def.name}>
                        {def.label}
                      </span>
                      <select
                        id={`link-${def.name}`}
                        value={links[def.name] ?? ""}
                        onChange={(e) =>
                          setLinks((prev) => {
                            const next = { ...prev };
                            if (e.target.value) next[def.name] = e.target.value;
                            else delete next[def.name];
                            return next;
                          })
                        }
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1"
                      >
                        <option value="">— leave alone —</option>
                        {importedNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save to this site"}
                </button>
                {saved && <span className="text-xs text-muted-foreground">{saved}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

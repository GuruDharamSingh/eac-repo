/**
 * What survives the trip to an inbox.
 *
 * The studio canvas is a browser. Outlook on Windows renders through WORD, and
 * Gmail rewrites the document before it ever reaches a renderer. So "it looks
 * right in the editor" is evidence about Chrome, not about mail.
 *
 * This lists, per letter, the CSS that a major client will drop — and, where
 * dropping it leaves unreadable text rather than a cosmetic difference, says so.
 */
import { renderSample, TEMPLATE_META } from "../src/samples";

interface Risk {
  what: string;
  where: string;
  severity: "breaks" | "degrades";
  note: string;
}

function scan(html: string): Risk[] {
  const risks: Risk[] = [];

  // Word has no gradient support at all. If the only background IS a gradient,
  // the element renders with NO background — and any light text on it lands on
  // white.
  for (const m of html.matchAll(/style="[^"]*linear-gradient\([^"]*"/g)) {
    const style = m[0];
    const hasSolidFallback = /background-color:\s*#|background:\s*#[0-9a-f]{3,8}[^)]*linear-gradient/i.test(style);
    risks.push({
      what: "linear-gradient background",
      where: "Outlook 2007–2019 (Word engine)",
      severity: hasSolidFallback ? "degrades" : "breaks",
      note: hasSolidFallback
        ? "falls back to the solid colour beside it"
        : "NO background-color fallback — the element renders white, and light text on it disappears",
    });
  }

  if (/@font-face/i.test(html)) {
    risks.push({
      what: "@font-face (Brothers / Basteleur)",
      where: "Gmail, Outlook, Yahoo",
      severity: "degrades",
      note: "stripped outright; these clients show the fallback stack (Georgia/serif)",
    });
  }

  if (/max-width:\s*\d/.test(html) && !/<!--\[if mso\]/.test(html)) {
    risks.push({
      what: "max-width with no MSO fallback",
      where: "Outlook (Word engine)",
      severity: "breaks",
      note: "max-width is ignored and nothing else constrains the width — the letter runs the full reading pane",
    });
  }

  for (const prop of ["display:\\s*flex", "display:\\s*grid", "aspect-ratio", "position:\\s*absolute", "float"]) {
    if (new RegExp(prop, "i").test(html)) {
      risks.push({
        what: prop.replace(/\\\\s\*/g, " "),
        where: "most clients",
        severity: "breaks",
        note: "not supported in email layout; use tables",
      });
    }
  }

  if (/<style/i.test(html) && !/style="/.test(html)) {
    risks.push({
      what: "a <style> block with no inlined equivalent",
      where: "Gmail (clipped/stripped in some contexts)",
      severity: "degrades",
      note: "rules may not apply; inline what matters",
    });
  }

  if (/border-radius/i.test(html)) {
    risks.push({
      what: "border-radius",
      where: "Outlook (Word engine)",
      severity: "degrades",
      note: "corners render square — cosmetic",
    });
  }

  return risks;
}

const seen = new Set<string>();
let breaks = 0;

for (const meta of TEMPLATE_META) {
  const html = await renderSample(meta.key, { orgName: "Amrit Canada" });
  if (!html) continue;
  const risks = scan(html);
  const key = risks.map((r) => r.what).sort().join("|");
  if (seen.has(key)) continue;
  seen.add(key);

  console.log(`\n── ${meta.key} ${"─".repeat(Math.max(0, 40 - meta.key.length))}`);
  for (const r of risks) {
    if (r.severity === "breaks") breaks += 1;
    console.log(`  ${r.severity === "breaks" ? "BREAKS  " : "degrades"}  ${r.what}`);
    console.log(`            ${r.where} — ${r.note}`);
  }
  if (risks.length === 0) console.log("  nothing client-hostile found");
}

console.log(
  breaks === 0
    ? "\nNothing that renders unreadable. Differences are cosmetic."
    : `\n${breaks} thing(s) that render UNREADABLE somewhere, not merely different.`
);

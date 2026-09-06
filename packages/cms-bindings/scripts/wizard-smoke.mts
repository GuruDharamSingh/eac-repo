/**
 * Prove the manifest → wizard-steps → cms-ui-shape pipeline.
 *   pnpm --filter @elkdonis/cms-bindings tsx scripts/wizard-smoke.mts
 */
import { loadTemplateManifest } from "../src/node";
import { buildWorkshopWizardSteps } from "../src/workshop/wizard-config";
import { toWizardUiSteps, wizardAnswersToColumns } from "../src/workshop/wizard-ui";

const manifest = loadTemplateManifest("workshop");
const steps = buildWorkshopWizardSteps(manifest);
const ui = toWizardUiSteps(steps);

console.log(`${ui.length} wizard steps derived from the workshop manifest:\n`);
for (const step of ui) {
  const tag = step.optional ? " (optional)" : "";
  console.log(`  [${step.source}] ${step.id} — ${step.label}${tag}`);
  for (const field of step.fields) {
    const extra = field.slot
      ? ` slot=${field.slot}`
      : field.options
        ? ` (${field.options.length} options)`
        : "";
    const target = `${field.binding.table}.${field.binding.dataKey ?? field.binding.col}`;
    console.log(
      `      ${field.name.padEnd(22)} ${field.input.padEnd(9)}${field.required ? " *" : "  "} -> ${target}${extra}`
    );
  }
}

console.log("\nanswers (by trait) -> columns:");
console.log(
  wizardAnswersToColumns(ui, {
    title: "Clay & Breath",
    discipline: "Ceramics",
    descriptionLong: "<p>Two hands, one pot.</p>",
    unknownTrait: "ignored",
  })
);

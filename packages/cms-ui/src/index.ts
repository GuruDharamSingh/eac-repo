// ============================================================================
// @elkdonis/cms-ui — shared authoring UI for the shadcn/Tailwind apps
// (hidden-enneagram, amrit-canada, arts-collective).
//
// Source-exported and unbundled, the same posture as @elkdonis/checkout:
// consuming apps list it in `transpilePackages` and add an `@source`
// directive so Tailwind scans it. Styling uses hsl(var(--token)) utilities
// only, so each site's own palette drives it with no theme of its own.
//
// Deliberately separate from @elkdonis/ui, which is Mantine-based — importing
// that would drag Mantine into apps that have intentionally stayed on shadcn.
// ============================================================================

export {
  WizardProvider,
  useWizard,
  useWizardOptional,
  WizardNav,
  StepIndicator,
  WizardFieldControl,
  TemplateWizard,
} from "./wizard";
export type {
  WizardContextValue,
  WizardProviderProps,
  WizardSaveStatus,
  WizardNavProps,
  StepIndicatorProps,
  WizardFieldSpec,
  WizardFieldInput,
  WizardFieldOption,
  TemplateWizardProps,
  TemplateWizardStep,
} from "./wizard";

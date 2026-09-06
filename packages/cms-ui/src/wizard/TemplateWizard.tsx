"use client";

import * as React from "react";
import {
  WizardProvider,
  useWizard,
  type WizardStepMeta,
} from "./WizardProvider";
import { WizardNav } from "./WizardNav";
import { StepIndicator } from "./StepIndicator";
import { WizardFieldControl, type WizardFieldSpec } from "./fields";

// ============================================================================
// The manifest-driven authoring wizard, assembled.
//
// A step is a group of fields plus optional bespoke content. Steps come from
// the template manifest (via `@elkdonis/cms-bindings buildWorkshopWizardSteps`,
// mapped to `TemplateWizardStep` by the consuming app); this component turns
// them into a working form over the existing `WizardProvider` state machine —
// autosave, staleness-aware hydration, per-id progress cache, all already there.
//
// It is deliberately the *default* authoring surface: no canvas, no CSS, no
// drag-and-drop. Everything the author can change is a declared field.
// ============================================================================

export interface TemplateWizardStep extends WizardStepMeta {
  /** Fields rendered top-to-bottom. Empty for a fully bespoke step. */
  fields: WizardFieldSpec[];
  /**
   * Rendered after the fields — a session list, a media picker, a review
   * summary. Receives the live answers and a patcher.
   */
  render?: (props: {
    answers: Record<string, unknown>;
    patch: (fields: Record<string, unknown>) => void;
  }) => React.ReactNode;
  /** Shown under the step title. */
  intro?: React.ReactNode;
}

export interface TemplateWizardProps<T extends Record<string, unknown>> {
  /** Namespaces the draft cache, e.g. `workshop:th_abc`. */
  storageKey: string;
  steps: TemplateWizardStep[];
  initialAnswers?: Partial<T>;
  serverUpdatedAt?: string | Date | null;
  /** Persist the draft. Throw to surface an error and block navigation. */
  onSave: (answers: Partial<T>) => Promise<void>;
  /** Last step's primary button. */
  onFinish: (answers: Partial<T>) => void | Promise<void>;
  /** After a successful "Save & exit". Omit to hide that button. */
  onExit?: () => void;
  finishLabel?: string;
  autosaveMs?: number;
  /** Hide a step for the current answers (a conditional step). */
  isStepVisible?: (step: TemplateWizardStep, answers: Partial<T>) => boolean;
}

export function TemplateWizard<T extends Record<string, unknown>>({
  storageKey,
  steps,
  initialAnswers,
  serverUpdatedAt,
  onSave,
  onFinish,
  onExit,
  finishLabel = "Publish",
  autosaveMs = 2000,
  isStepVisible,
}: TemplateWizardProps<T>) {
  return (
    <WizardProvider<T>
      storageKey={storageKey}
      steps={steps}
      initialAnswers={initialAnswers}
      serverUpdatedAt={serverUpdatedAt}
      onSave={onSave}
      autosaveMs={autosaveMs}
      isStepVisible={
        isStepVisible
          ? (s, a) => isStepVisible(s as TemplateWizardStep, a)
          : undefined
      }
    >
      <TemplateWizardInner<T> steps={steps} onFinish={onFinish} onExit={onExit} finishLabel={finishLabel} />
    </WizardProvider>
  );
}

function TemplateWizardInner<T extends Record<string, unknown>>({
  steps,
  onFinish,
  onExit,
  finishLabel,
}: {
  steps: TemplateWizardStep[];
  onFinish: (answers: Partial<T>) => void | Promise<void>;
  onExit?: () => void;
  finishLabel: string;
}) {
  const { stepId, step, answers, patch, hydrated } = useWizard<T>();

  const current = React.useMemo(
    () => steps.find((s) => s.id === stepId) ?? steps[step - 1],
    [steps, stepId, step]
  );

  // Steps whose required fields are still empty — surfaced on the indicator so
  // the author can jump straight to what's unfinished instead of guessing.
  const invalidSteps = React.useMemo(() => {
    const nums: number[] = [];
    steps.forEach((s, i) => {
      const missing = s.fields.some(
        (f) => f.required && isEmpty((answers as Record<string, unknown>)[f.name])
      );
      if (missing) nums.push(i + 1);
    });
    return nums;
  }, [steps, answers]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4 p-6">
        <div className="h-4 w-1/3 rounded bg-[hsl(var(--muted))]" />
        <div className="h-10 rounded bg-[hsl(var(--muted))]" />
        <div className="h-10 rounded bg-[hsl(var(--muted))]" />
        <div className="h-24 rounded bg-[hsl(var(--muted))]" />
      </div>
    );
  }

  if (!current) return null;

  const answersRecord = answers as Record<string, unknown>;
  const patchRecord = patch as (fields: Record<string, unknown>) => void;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <StepIndicator invalidSteps={invalidSteps} />

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          {current.label ?? `Step ${step}`}
        </h2>
        {current.description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {current.description}
          </p>
        )}
        {current.intro && <div className="mt-3">{current.intro}</div>}
      </div>

      <div className="mt-6 space-y-5">
        {current.fields.map((field) => (
          <WizardFieldControl
            key={field.name}
            field={field}
            value={answersRecord[field.name]}
            onChange={(value) => patch({ [field.name]: value } as Partial<T>)}
          />
        ))}

        {current.render?.({ answers: answersRecord, patch: patchRecord })}
      </div>

      <WizardNav
        finishLabel={finishLabel}
        onExit={onExit}
        onFinish={() => onFinish(answers)}
        disableAdvance={current.fields.some(
          (f) => f.required && isEmpty(answersRecord[f.name])
        )}
      />
    </div>
  );
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

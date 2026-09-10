"use client";

import * as React from "react";
import { useWizardOptional } from "./WizardProvider";

// ============================================================================
// Step progress.
//
// Two variants, merged from the two implementations this replaces:
//
//  - "chips" (default) — one labelled, clickable chip per step. Steps flagged
//    in `invalidSteps` are marked and remain navigable. arts-collective's
//    version was aria-hidden and inert, which made its final "some earlier
//    step is invalid" state a dead end: no way to jump to the offending step,
//    only Back pressed seven times.
//  - "bar" — arts-collective's compact segmented bar with a "Step n of N"
//    caption. Better than chips for a long fixed-length onboarding flow where
//    the step names are not worth the horizontal space.
//
// `step`/`totalSteps` may be passed explicitly for use outside a provider
// (the business onboarding flow renders it that way). Reading context through
// `useWizardOptional` rather than a try/catch around `useWizard` matters: the
// latter is a conditional hook call that only worked by render-order accident
// and breaks under concurrent rendering.
// ============================================================================

export interface StepIndicatorProps {
  /**
   * Short labels, one per step. Optional in step-list mode: the labels of the
   * currently visible steps are used, so a template-derived wizard does not
   * have to restate them (and cannot drift out of sync with the real list).
   */
  labels?: string[];
  /** 1-based step numbers that failed validation. */
  invalidSteps?: number[];
  /** Set false for a purely decorative indicator. Ignored by the bar variant. */
  navigable?: boolean;
  variant?: "chips" | "bar";
  /** Override the current step — for rendering outside a provider. */
  step?: number;
  /** Override the step count — for rendering outside a provider. */
  totalSteps?: number;
  className?: string;
}

export function StepIndicator({
  labels,
  invalidSteps = [],
  navigable = true,
  variant = "chips",
  step: stepProp,
  totalSteps: totalProp,
  className,
}: StepIndicatorProps) {
  const wizard = useWizardOptional();

  const step = stepProp ?? wizard?.step;
  const total = totalProp ?? wizard?.totalSteps;

  // Nothing to draw: no provider and no explicit override.
  if (step == null || total == null) return null;

  if (variant === "bar") {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        {Array.from({ length: total }).map((_, i) => {
          const n = i + 1;
          const tone =
            n < step
              ? "bg-[hsl(var(--primary))]"
              : n === step
                ? "bg-[hsl(var(--primary))]/70"
                : "bg-[hsl(var(--border))]";
          return (
            <div
              key={n}
              aria-hidden
              className={`h-1.5 flex-1 rounded-full transition-colors ${tone}`}
            />
          );
        })}
        <span className="ml-3 whitespace-nowrap text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          Step {step} of {total}
        </span>
      </div>
    );
  }

  const resolved =
    labels ??
    wizard?.visibleSteps.map((s, i) => s.label ?? `Step ${i + 1}`) ??
    Array.from({ length: total }, (_, i) => `Step ${i + 1}`);

  const setStep = wizard?.setStep;
  const canNavigate = navigable && Boolean(setStep);

  return (
    <ol className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {resolved.map((label, i) => {
        const n = i + 1;
        const isCurrent = n === step;
        const isDone = n < step;
        const isInvalid = invalidSteps.includes(n);

        const base =
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors";
        const tone = isInvalid
          ? "border-[hsl(var(--destructive))] text-[hsl(var(--destructive))]"
          : isCurrent
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : isDone
              ? "border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
              : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]";

        const content = (
          <>
            <span className="font-medium tabular-nums">{n}</span>
            <span className="hidden sm:inline">{label}</span>
            {isInvalid && <span aria-hidden>!</span>}
          </>
        );

        return (
          <li key={label}>
            {canNavigate ? (
              <button
                type="button"
                onClick={() => setStep!(n)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${n}: ${label}${isInvalid ? " (needs attention)" : ""}`}
                className={`${base} ${tone} cursor-pointer hover:opacity-80`}
              >
                {content}
              </button>
            ) : (
              <span aria-current={isCurrent ? "step" : undefined} className={`${base} ${tone}`}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import * as React from "react";
import { useWizardOptional } from "./WizardProvider";

// ============================================================================
// Step progress. Clickable by default — arts-collective's version was
// aria-hidden and inert, which made its final "some earlier step is invalid"
// state a dead end: no way to jump to the offending step, only Back pressed
// seven times. Steps flagged in `invalidSteps` are marked so that state is
// actually navigable.
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
  /** Set false for a purely decorative indicator. */
  navigable?: boolean;
  className?: string;
}

export function StepIndicator({
  labels,
  invalidSteps = [],
  navigable = true,
  className,
}: StepIndicatorProps) {
  const wizard = useWizardOptional();
  if (!wizard) return null;

  const { step, setStep, visibleSteps } = wizard;
  const resolved =
    labels ?? visibleSteps.map((s, i) => s.label ?? `Step ${i + 1}`);

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
            {navigable ? (
              <button
                type="button"
                onClick={() => setStep(n)}
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

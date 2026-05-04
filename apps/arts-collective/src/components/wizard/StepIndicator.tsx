"use client";

import * as React from "react";
import { useWizard } from "./WizardProvider";
import { cn } from "@/lib/utils";

export function StepIndicator({
  customStep,
  customTotal,
}: {
  customStep?: number;
  customTotal?: number;
}) {
  // Use context if props are missing, but wrap in try/catch or check for null
  // because useWizard throws if outside its provider.
  let step = customStep ?? 1;
  let totalSteps = customTotal ?? 1;

  try {
    const ctx = useWizard();
    if (customStep === undefined) step = ctx.step;
    if (customTotal === undefined) totalSteps = ctx.totalSteps;
  } catch {
    // If we're here, we're likely in a different wizard (like Business)
    // and relying on props. If props were ALSO missing, we default to 1/1.
  }

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "active" : "future";
        return (
          <div
            key={n}
            aria-hidden
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              state === "done" && "bg-primary",
              state === "active" && "bg-primary/70",
              state === "future" && "bg-border"
            )}
          />
        );
      })}
      <span className="ml-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        Step {step} of {totalSteps}
      </span>
    </div>
  );
}

"use client";

import * as React from "react";
import { StepIndicator as SharedStepIndicator } from "@elkdonis/cms-ui";

// ============================================================================
// The onboarding flow's compact progress bar, now the shared component's
// "bar" variant. The local copy read context through a try/catch around
// useWizard() — a conditional hook call that only worked by render-order
// accident; the shared one uses useWizardOptional and takes explicit
// step/total overrides for the business flow, which renders outside a
// provider.
// ============================================================================

export function StepIndicator({
  customStep,
  customTotal,
}: {
  customStep?: number;
  customTotal?: number;
}) {
  return (
    <SharedStepIndicator variant="bar" step={customStep} totalSteps={customTotal} />
  );
}

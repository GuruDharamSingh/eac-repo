"use client";

import * as React from "react";
import {
  WizardProvider as SharedWizardProvider,
  useWizard as useSharedWizard,
} from "@elkdonis/cms-ui";
import type { WizardAnswers } from "@/lib/schema";
import { TOTAL_STEPS } from "@/lib/schema";

// ============================================================================
// Artist onboarding wizard — an adapter over @elkdonis/cms-ui's provider.
//
// This file used to be a 115-line state machine, and BusinessWizardProvider
// next door was a near-identical copy of it. The shared provider was written
// by generalising exactly these two and fixing four bugs they both had:
// draft loss mid-step (patch only ran on submit), a stale localStorage blob
// overwriting fresher server values, save failures that redirected anyway, and
// a conditional useWizard() call inside try/catch.
//
// It is kept as a module rather than deleted so the thirteen step components
// can go on importing `useWizard` from here; only the engine is shared. The
// context shape is a superset of the old one, so those steps need no changes.
// ============================================================================

type Props = {
  userId: string;
  initialAnswers?: Partial<WizardAnswers>;
  children: React.ReactNode;
};

export function WizardProvider({ userId, initialAnswers, children }: Props) {
  return (
    <SharedWizardProvider<WizardAnswers>
      // Same key shape the old provider used, so drafts in progress survive.
      storageKey={userId}
      totalSteps={TOTAL_STEPS}
      initialAnswers={initialAnswers}
      // No onSave: these steps persist through their own server actions on
      // submit. Autosave off keeps that contract unchanged.
      autosaveMs={0}
    >
      {children}
    </SharedWizardProvider>
  );
}

export function useWizard() {
  return useSharedWizard<WizardAnswers>();
}

"use client";

import * as React from "react";
import {
  WizardProvider as SharedWizardProvider,
  useWizard as useSharedWizard,
} from "@elkdonis/cms-ui";
import type { BusinessWizardAnswers } from "@/lib/business-schema";
import { BIZ_TOTAL_STEPS } from "@/lib/business-schema";

// ============================================================================
// Business onboarding wizard — an adapter over @elkdonis/cms-ui's provider.
//
// This was a near-identical copy of WizardProvider next door, differing only
// in storage key, step count and answer type. Those three are exactly what
// the shared provider is parameterised on, so both are now the same engine.
// See WizardProvider.tsx for the bugs that engine fixes.
// ============================================================================

type Props = {
  userId: string;
  initialAnswers?: Partial<BusinessWizardAnswers>;
  children: React.ReactNode;
};

export function BusinessWizardProvider({ userId, initialAnswers, children }: Props) {
  return (
    <SharedWizardProvider<BusinessWizardAnswers>
      // Same key shape the old provider used, so drafts in progress survive.
      storageKey={`business:${userId}`}
      totalSteps={BIZ_TOTAL_STEPS}
      initialAnswers={initialAnswers}
      // No onSave: these steps persist through their own server actions on
      // submit. Autosave off keeps that contract unchanged.
      autosaveMs={0}
    >
      {children}
    </SharedWizardProvider>
  );
}

export function useBusinessWizard() {
  return useSharedWizard<BusinessWizardAnswers>();
}

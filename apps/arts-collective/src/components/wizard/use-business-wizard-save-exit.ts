"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useBusinessWizard } from "./BusinessWizardProvider";
import type { BusinessWizardAnswers } from "@/lib/business-schema";

export function useBusinessWizardSaveAndExit() {
  const router = useRouter();
  const { answers, patch } = useBusinessWizard();
  const [saving, setSaving] = useState(false);

  const saveAndExit = useCallback(
    async (stepValues: Partial<BusinessWizardAnswers>) => {
      setSaving(true);
      patch(stepValues);
      const merged = { ...answers, ...stepValues };
      try {
        await fetch("/api/wizard/business/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
      } catch {
        // non-fatal — localStorage still has the in-progress state
      }
      router.push("/hub");
    },
    [answers, patch, router]
  );

  return { saveAndExit, saving };
}

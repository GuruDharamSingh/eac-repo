"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "./WizardProvider";
import type { WizardAnswers } from "@/lib/schema";

export function useWizardSaveAndExit() {
  const router = useRouter();
  const { answers, patch } = useWizard();
  const [saving, setSaving] = useState(false);

  const saveAndExit = useCallback(
    async (stepValues: Partial<WizardAnswers>) => {
      setSaving(true);
      patch(stepValues);
      const merged = { ...answers, ...stepValues };
      try {
        await fetch("/api/wizard/save", {
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

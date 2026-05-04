"use client";

import { Button } from "@/components/ui/button";
import { useBusinessWizard } from "./BusinessWizardProvider";

type Props = {
  submitting?: boolean;
  continueLabel?: string;
  onSaveAndExit?: () => void | Promise<void>;
  saving?: boolean;
  hideSaveExit?: boolean;
};

export function BusinessWizardNav({
  submitting,
  continueLabel = "Continue",
  onSaveAndExit,
  saving,
  hideSaveExit,
}: Props) {
  const { step, back } = useBusinessWizard();
  const disabled = submitting || saving;

  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {step > 1 && (
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={disabled}
          >
            Back
          </Button>
        )}
        {!hideSaveExit && onSaveAndExit && (
          <Button
            type="button"
            variant="outline"
            onClick={onSaveAndExit}
            disabled={disabled}
            aria-busy={saving}
          >
            {saving ? "Saving..." : "Save & return to hub"}
          </Button>
        )}
      </div>
      <Button type="submit" disabled={disabled} aria-busy={submitting}>
        {submitting ? "Working..." : continueLabel}
      </Button>
    </div>
  );
}

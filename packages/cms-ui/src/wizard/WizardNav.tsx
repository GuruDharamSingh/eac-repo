"use client";

import * as React from "react";
import { useWizard } from "./WizardProvider";

// ============================================================================
// Back / Save & exit / Next-or-finish footer.
//
// Unlike arts-collective's version, "Save & exit" awaits the save and only
// navigates when it actually succeeded — there, the fetch result was ignored
// and the redirect fired regardless, so a failed save looked identical to a
// successful one. Autosave status is surfaced here too, so the draft state
// is visible rather than implied.
// ============================================================================

export interface WizardNavProps {
  /** Called on the last step's primary button. */
  onFinish?: () => void | Promise<void>;
  /** Called after a successful save-and-exit. Omit to hide that button. */
  onExit?: () => void;
  finishLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  exitLabel?: string;
  /** Blocks Next/Finish (e.g. the current step hasn't validated). */
  disableAdvance?: boolean;
  busy?: boolean;
}

const BTN =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const PRIMARY = `${BTN} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90`;
const GHOST = `${BTN} border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]`;

export function WizardNav({
  onFinish,
  onExit,
  finishLabel = "Finish",
  nextLabel = "Next",
  backLabel = "Back",
  exitLabel = "Save & exit",
  disableAdvance = false,
  busy = false,
}: WizardNavProps) {
  const { step, totalSteps, next, back, save, saveStatus, saveError, lastSavedAt } = useWizard();
  const [exiting, setExiting] = React.useState(false);
  const isLast = step >= totalSteps;

  const handleExit = async () => {
    if (!onExit) return;
    setExiting(true);
    const ok = await save();
    setExiting(false);
    // Only leave if the draft actually persisted; otherwise the error below
    // stays on screen and the user keeps their work.
    if (ok) onExit();
  };

  return (
    <div className="mt-8 space-y-2 border-t border-[hsl(var(--border))] pt-4">
      {saveError && (
        <p role="alert" className="text-sm text-[hsl(var(--destructive))]">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={GHOST} onClick={back} disabled={step <= 1 || busy}>
          {backLabel}
        </button>

        <span aria-live="polite" className="text-xs text-[hsl(var(--muted-foreground))]">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "error"
              ? "Not saved"
              : lastSavedAt
                ? `Draft saved ${lastSavedAt.toLocaleTimeString()}`
                : `Step ${step} of ${totalSteps}`}
        </span>

        <div className="flex items-center gap-2">
          {onExit && (
            <button type="button" className={GHOST} onClick={handleExit} disabled={exiting || busy}>
              {exiting ? "Saving…" : exitLabel}
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className={PRIMARY}
              onClick={() => onFinish?.()}
              disabled={disableAdvance || busy}
            >
              {finishLabel}
            </button>
          ) : (
            <button
              type="button"
              className={PRIMARY}
              onClick={next}
              disabled={disableAdvance || busy}
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  QuestionnaireBody,
  QuestionnaireComposeSurface as SharedQuestionnaireComposeSurface,
} from "@elkdonis/cms-ui/compose";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";

// ============================================================================
// Asking the membership something — IFAC's binding of the shared composer.
//
// The form itself is @elkdonis/cms-ui/compose now. What stays here is the only
// part that is genuinely this app's: the server action, and therefore the
// permission gate behind it (see questionnaire-actions.ts — IFAC has zero
// owner rows, so the check has to consult the allowlist first).
//
// The privacy note is passed rather than defaulted because it is a promise
// about THIS hub: "IFAC's administrators" is a true sentence here and would be
// a false one anywhere else.
// ============================================================================

const PRIVACY = {
  poll: "Everyone who answers sees the running result. It is never public.",
  questionnaire: "Answers are visible to IFAC's administrators only.",
} as const;

export function QuestionnaireComposeSurface({
  kind,
}: {
  kind: "questionnaire" | "poll";
}) {
  return (
    <SharedQuestionnaireComposeSurface
      kind={kind}
      onSave={createQuestionnaireAction}
      privacyNote={PRIVACY}
    />
  );
}

/** The bare form, for the compose PAGE. Same component, different frame. */
export function QuestionnairePageBody({
  kind,
  onDone,
}: {
  kind: "questionnaire" | "poll";
  onDone: () => void;
}) {
  return (
    <QuestionnaireBody
      kind={kind}
      onSave={createQuestionnaireAction}
      privacyNote={PRIVACY}
      onDone={onDone}
    />
  );
}

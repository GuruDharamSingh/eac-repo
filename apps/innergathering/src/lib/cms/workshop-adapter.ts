import { workshopInputFromAnswers } from "@elkdonis/services/workshop-answers";
import type { WorkshopOfferingInput } from "@elkdonis/services";

/**
 * Shared compose answers → the workshop offering the service writes.
 * The translation lives in @elkdonis/services (workshopInputFromAnswers, 2026-11-14)
 * so every site's workshop form saves the same way; this name is kept for the callers here.
 */
export function toWorkshopInput(answers: Record<string, unknown>, status: "draft" | "published"): WorkshopOfferingInput {
  return workshopInputFromAnswers(answers, status);
}

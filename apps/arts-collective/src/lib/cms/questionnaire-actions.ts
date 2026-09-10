"use server";

import { revalidatePath } from "next/cache";
import {
  canManageQuestionnaires,
  createOrgQuestionnaire,
  type QuestionnaireField,
  type QuestionnaireKind,
  type ResultsVisibility,
} from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";

export type CreateQuestionnaireResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

/**
 * Create a questionnaire or poll from an org's hub.
 *
 * The two differ only in presentation — a poll is one choice question whose
 * results the answerers can see — so they share this action and the whole
 * storage path (migration 103). Authorisation is the same
 * `canManageQuestionnaires` (owner or guide) the rest of the questionnaire
 * surface uses; it is checked here rather than trusted from the client, since
 * a server action is a public endpoint.
 */
export async function createQuestionnaireAction(input: {
  orgSlug: string;
  title: string;
  description?: string;
  fields: QuestionnaireField[];
  kind: QuestionnaireKind;
  resultsVisibility?: ResultsVisibility;
  closesAt?: string | null;
}): Promise<CreateQuestionnaireResult> {
  const user = await requireUser();

  const org = await getOrgBySlug(input.orgSlug);
  if (!org) return { ok: false, error: "Organisation not found" };

  if (!(await canManageQuestionnaires(user.id, org.id))) {
    return { ok: false, error: "Not authorized" };
  }

  const result = await createOrgQuestionnaire(org.id, user.id, {
    title: input.title,
    description: input.description,
    fields: input.fields,
    kind: input.kind,
    // A poll that nobody can see the result of is not a poll. Anything else
    // keeps the private default: answers to an org's questionnaire are for
    // that org, not the network.
    resultsVisibility:
      input.resultsVisibility ?? (input.kind === "poll" ? "respondents" : "admins"),
    closesAt: input.closesAt ?? null,
  });

  if (result.ok) revalidatePath("/hub/organization");
  return result;
}

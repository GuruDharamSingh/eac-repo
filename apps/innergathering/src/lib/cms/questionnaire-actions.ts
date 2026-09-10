"use server";

import { revalidatePath } from "next/cache";
import {
  canManageQuestionnaires,
  createOrgQuestionnaire,
  type QuestionnaireField,
  type QuestionnaireKind,
} from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export type CreateQuestionnaireResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

/**
 * Create a questionnaire or poll for this site's org.
 *
 * A thin wrapper, deliberately: the rules live in `createOrgQuestionnaire` in
 * @elkdonis/services, so this site and arts-collective cannot drift on what a
 * questionnaire is. What is per-app is only the session shape and the fixed
 * orgId — this container serves one org (see config/site.ts).
 */
export async function createQuestionnaireAction(input: {
  title: string;
  description?: string;
  fields: QuestionnaireField[];
  kind: QuestionnaireKind;
  closesAt?: string | null;
}): Promise<CreateQuestionnaireResult> {
  const viewer = await requireOrgEditor("/manage/compose");

  if (!(await canManageQuestionnaires(viewer.userId, siteConfig.orgId))) {
    return { ok: false, error: "Not authorized" };
  }

  const result = await createOrgQuestionnaire(siteConfig.orgId, viewer.userId, {
    title: input.title,
    description: input.description,
    fields: input.fields,
    kind: input.kind,
    resultsVisibility: input.kind === "poll" ? "respondents" : "admins",
    closesAt: input.closesAt ?? null,
  });

  if (result.ok) revalidatePath("/manage");
  return result;
}

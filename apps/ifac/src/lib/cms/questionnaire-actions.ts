"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import {
  createOrgQuestionnaire,
  type QuestionnaireField,
  type QuestionnaireKind,
} from "@elkdonis/services";
import { canManageIfac } from "@/lib/data";
import { siteConfig } from "@/config/site";

export type CreateQuestionnaireResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

/**
 * Create a questionnaire or poll for IFAC.
 *
 * Gated on `canManageIfac`, NOT on the shared `canManageQuestionnaires`, and
 * that difference is load-bearing here: `canManageIfac` checks
 * `siteConfig.ownerEmails` FIRST, and IFAC has **zero owners** in
 * `user_organizations` (18 roster rows, 1 guide). A role-only check would lock
 * the people who actually run this site out of their own hub.
 *
 * The allowlist reads like legacy cruft — every other app's comments say
 * theirs was removed — but it is currently IFAC's only administrator path.
 * Seed owners before retiring it.
 */
export async function createQuestionnaireAction(input: {
  title: string;
  description?: string;
  fields: QuestionnaireField[];
  kind: QuestionnaireKind;
  closesAt?: string | null;
}): Promise<CreateQuestionnaireResult> {
  const session = await getServerSession();
  if (!session.user) return { ok: false, error: "Not signed in" };

  if (!(await canManageIfac(session))) {
    return { ok: false, error: "Not authorized" };
  }

  const userId = session.user.db_user_id ?? session.user.id;

  const result = await createOrgQuestionnaire(siteConfig.orgId, userId, {
    title: input.title,
    description: input.description,
    fields: input.fields,
    kind: input.kind,
    // IFAC's hub has always promised "results are never public by design", so
    // a poll here shows its tally to the people who answered and no further.
    resultsVisibility: input.kind === "poll" ? "respondents" : "admins",
    closesAt: input.closesAt ?? null,
  });

  if (result.ok) revalidatePath("/hub");
  return result;
}

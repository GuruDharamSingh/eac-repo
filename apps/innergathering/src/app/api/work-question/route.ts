import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";
import { getProfile } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * A response to the Current Work Question. Anyone may answer; a signed-in
 * member's response carries their user id and account name.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    questionId?: string;
    response?: string;
    displayName?: string | null;
  };
  const response = (body.response ?? "").trim();
  if (!body.questionId || !response) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }
  if (response.length > 4000) {
    return NextResponse.json({ error: "That is longer than a response can be." }, { status: 400 });
  }

  const [question] = await db<{ id: string }[]>`
    SELECT id FROM work_questions WHERE id = ${body.questionId} AND org_id = ${siteConfig.orgId} AND is_active = TRUE
  `;
  if (!question) return NextResponse.json({ error: "That question is no longer open." }, { status: 404 });

  const viewer = await getViewer().catch(() => null);
  const profile = viewer ? await getProfile(viewer.userId).catch(() => null) : null;
  const displayName = viewer ? profile?.displayName ?? viewer.email.split("@")[0] : (body.displayName ?? "").trim().slice(0, 80) || null;

  await db`
    INSERT INTO work_question_responses (question_id, user_id, display_name, response)
    VALUES (${question.id}, ${viewer?.userId ?? null}, ${displayName}, ${response})
  `;
  return NextResponse.json({ ok: true, displayName });
}

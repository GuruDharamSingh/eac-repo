import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const { questionId, response } = await req.json();

    if (!questionId || !response?.trim()) {
      return NextResponse.json({ error: 'Missing questionId or response' }, { status: 400 });
    }

    const displayName = session?.user?.user_metadata?.display_name
      ?? session?.user?.email
      ?? null;

    await db`
      INSERT INTO work_question_responses (question_id, user_id, display_name, response)
      VALUES (
        ${questionId},
        ${session?.user?.id ?? null},
        ${displayName},
        ${response.trim()}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[work-question respond POST]', err);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}

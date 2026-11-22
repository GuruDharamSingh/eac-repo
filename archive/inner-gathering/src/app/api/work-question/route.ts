import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const includeResponses = searchParams.get('responses') === '1';

  try {
    const rows = await db`
      SELECT id, question, created_at
      FROM work_questions
      WHERE org_id = 'inner_group' AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ question: null });

    if (!includeResponses) return NextResponse.json({ question: rows[0] });

    const responses = await db`
      SELECT display_name, response, created_at
      FROM work_question_responses
      WHERE question_id = ${rows[0].id}
      ORDER BY created_at DESC
      LIMIT 40
    `;

    return NextResponse.json({ question: rows[0], responses });
  } catch (err) {
    console.error('[work-question GET]', err);
    return NextResponse.json({ error: 'Failed to load question' }, { status: 500 });
  }
}

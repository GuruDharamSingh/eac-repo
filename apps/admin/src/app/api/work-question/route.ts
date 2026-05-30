import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

export async function GET() {
  try {
    const questions = await db`
      SELECT
        wq.id,
        wq.question,
        wq.is_active,
        wq.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',           wqr.id,
              'display_name', wqr.display_name,
              'response',     wqr.response,
              'created_at',   wqr.created_at
            ) ORDER BY wqr.created_at DESC
          ) FILTER (WHERE wqr.id IS NOT NULL),
          '[]'
        ) AS responses
      FROM work_questions wq
      LEFT JOIN work_question_responses wqr ON wqr.question_id = wq.id
      WHERE wq.org_id = 'inner_group'
      GROUP BY wq.id
      ORDER BY wq.created_at DESC
    `;
    return NextResponse.json({ questions });
  } catch (err) {
    console.error('[admin work-question GET]', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Deactivate all previous questions for this org
    await db`
      UPDATE work_questions SET is_active = FALSE WHERE org_id = 'inner_group'
    `;

    const rows = await db`
      INSERT INTO work_questions (org_id, question, is_active)
      VALUES ('inner_group', ${question.trim()}, TRUE)
      RETURNING id, question, is_active, created_at
    `;

    return NextResponse.json({ question: rows[0] });
  } catch (err) {
    console.error('[admin work-question POST]', err);
    return NextResponse.json({ error: 'Failed to save question' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';
import { sanitizeRichText } from '@elkdonis/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const { questionId, response, signedName, notifyEmail } = await req.json();

    if (!questionId || !response?.trim()) {
      return NextResponse.json({ error: 'Missing questionId or response' }, { status: 400 });
    }

    const signedNameClean: string | null =
      typeof signedName === 'string' && signedName.trim() ? signedName.trim().slice(0, 120) : null;

    const notifyEmailRaw: string | null =
      typeof notifyEmail === 'string' && notifyEmail.trim() ? notifyEmail.trim().toLowerCase() : null;

    if (notifyEmailRaw && !EMAIL_RE.test(notifyEmailRaw)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const sessionDisplayName = session?.user?.user_metadata?.display_name
      ?? session?.user?.email
      ?? null;

    const displayName = signedNameClean ?? sessionDisplayName;

    await db`
      INSERT INTO work_question_responses (
        question_id, user_id, display_name, signed_name, notify_email, response
      )
      VALUES (
        ${questionId},
        ${session?.user?.id ?? null},
        ${displayName},
        ${signedNameClean},
        ${notifyEmailRaw},
        ${sanitizeRichText(response).trim()}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[work-question respond POST]', err);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}


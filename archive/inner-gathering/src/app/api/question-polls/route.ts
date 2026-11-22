/**
 * Question Polls API Routes
 * GET /api/question-polls - List question polls for organization
 * POST /api/question-polls - Create a new question poll
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import {
  createQuestionPoll,
  getQuestionPollsByOrg,
} from '@elkdonis/services';

const ORG_ID = 'inner_group';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const polls = await getQuestionPollsByOrg(ORG_ID);

    return NextResponse.json({ polls });
  } catch (error) {
    console.error('Failed to fetch question polls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      description,
      options,
      pollType = 'single_choice',
      showResultsBeforeVote = true,
      deadline,
    } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 options are required' },
        { status: 400 }
      );
    }

    const poll = await createQuestionPoll({
      orgId: ORG_ID,
      creatorId: session.user.id,
      question: question.trim(),
      description: description?.trim() || undefined,
      options: options.map((o: string) => o.trim()).filter(Boolean),
      pollType,
      showResultsBeforeVote,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    return NextResponse.json({ poll });
  } catch (error) {
    console.error('Failed to create question poll:', error);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}

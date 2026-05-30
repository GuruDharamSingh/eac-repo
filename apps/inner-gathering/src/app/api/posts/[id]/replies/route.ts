import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { createReply, getRepliesFlat } from '@elkdonis/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const replies = await getRepliesFlat(id);
    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Failed to fetch post replies:', error);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, parentId } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const reply = await createReply({
      threadId,
      parentId: typeof parentId === 'string' && parentId ? parentId : null,
      userId: session.user.id,
      content,
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Failed to create post reply:', error);
    return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
  }
}

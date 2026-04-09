import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { getReplies, createReply, db } from '@elkdonis/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const replies = await getReplies(id, 'meeting', 'oldest');
    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Failed to fetch replies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, parentId } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const reply = await createReply({
      threadId: id,
      threadType: 'meeting',
      parentId: parentId || null,
      userId: session.user.id,
      content: content.trim(),
    });

    // Fetch user profile for enrichment
    const [userProfile] = await db`
      SELECT display_name, avatar_url, comment_color FROM users WHERE id = ${session.user.id}
    `;

    const userName = userProfile?.display_name || session.user.email.split('@')[0];
    const nameParts = userName.split(' ');
    const initials = nameParts[0][0] + (nameParts[1]?.[0] || '');

    const enrichedReply = {
      id: reply.id,
      parentId: parentId || null,
      userId: session.user.id,
      content: content.trim(),
      createdAt: reply.created_at,
      updatedAt: reply.updated_at,
      editedAt: null,
      reactionCount: 0,
      userName,
      userAvatar: userProfile?.avatar_url || null,
      userInitials: initials.toUpperCase(),
      userTrustLevel: 0,
      commentColor: userProfile?.comment_color || null,
      children: [],
    };

    return NextResponse.json({ reply: enrichedReply });
  } catch (error) {
    console.error('Failed to create reply:', error);
    return NextResponse.json(
      { error: 'Failed to create reply' },
      { status: 500 }
    );
  }
}

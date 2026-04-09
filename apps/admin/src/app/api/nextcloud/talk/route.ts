import { NextRequest, NextResponse } from 'next/server';
import { talkService } from '@/lib/nextcloud';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createRoom': {
        const { roomType, roomName, invite } = body;
        const room = await talkService.createRoom({
          roomType,
          roomName,
          invite,
        });
        return NextResponse.json({ room });
      }

      case 'getRoom': {
        const { token } = body;
        const room = await talkService.getRoom(token);
        return NextResponse.json({ room });
      }

      case 'listRooms': {
        const rooms = await talkService.listRooms();
        return NextResponse.json({ rooms });
      }

      case 'addParticipant': {
        const { token, userId } = body;
        const success = await talkService.addParticipant(token, userId);
        return NextResponse.json({ success });
      }

      case 'createMeetingRoom': {
        const { meetingData } = body;
        const room = await talkService.createMeetingRoom(meetingData);
        return NextResponse.json({ room });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Talk API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
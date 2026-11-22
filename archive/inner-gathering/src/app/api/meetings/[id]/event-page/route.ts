import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { getEventPage, createEventPage, updateEventPage, getMeetingById } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const meeting = await getMeetingById(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const eventPage = await getEventPage(id);
    if (!eventPage) {
      return NextResponse.json({ error: 'Event page not found' }, { status: 404 });
    }

    return NextResponse.json({ eventPage });
  } catch (error) {
    console.error('Failed to fetch event page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event page' },
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

    const meeting = await getMeetingById(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const existing = await getEventPage(id);
    if (existing) {
      return NextResponse.json({ error: 'Event page already exists' }, { status: 409 });
    }

    const eventPage = await createEventPage(id);
    return NextResponse.json({ eventPage }, { status: 201 });
  } catch (error) {
    console.error('Failed to create event page:', error);
    return NextResponse.json(
      { error: 'Failed to create event page' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meeting = await getMeetingById(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const body = await request.json();

    const eventPage = await updateEventPage(id, {
      content: body.content,
      colors: body.colors,
      tableData: body.tableData,
      layout: body.layout,
      drawing: body.drawing,
      isPublished: body.isPublished,
    });

    if (!eventPage) {
      return NextResponse.json({ error: 'Event page not found' }, { status: 404 });
    }

    return NextResponse.json({ eventPage });
  } catch (error) {
    console.error('Failed to update event page:', error);
    return NextResponse.json(
      { error: 'Failed to update event page' },
      { status: 500 }
    );
  }
}

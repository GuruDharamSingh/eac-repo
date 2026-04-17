import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * PATCH /api/meetings/[id]/workshop
 *
 * Updates the workshop promotion fields for a meeting.
 *
 * Stage mapping:
 *   none     → show_on_workshops_page=false, workshop_order=null
 *   standby  → show_on_workshops_page=false, workshop_order=null  (metadata saved, hidden)
 *   upcoming → show_on_workshops_page=true,  workshop_order=null
 *   featured → show_on_workshops_page=true,  workshop_order=1|2|3
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json() as {
      stage: 'none' | 'standby' | 'upcoming' | 'featured';
      workshop_order?: number | null;
      subtitle?: string | null;
      card_colour?: string | null;
      card_accent_colour?: string | null;
      meeting_url?: string | null;
      meta_lead?: string;
      meta_format?: string;
      meta_workshop_status?: string;
      meta_workshop_type?: string;
      meta_capacity?: string;
    };

    const { stage } = body;

    const showOnPage = stage === 'upcoming' || stage === 'featured';
    const workshopOrder = stage === 'featured' ? (body.workshop_order ?? null) : null;

    // If claiming a featured slot, ensure it isn't already taken by another meeting
    if (stage === 'featured' && workshopOrder !== null) {
      const conflict = await db`
        SELECT id FROM threads
        WHERE kind = 'meeting'
          AND workshop_order = ${workshopOrder}
          AND id != ${id}
        LIMIT 1
      `;
      if (conflict.length > 0) {
        return NextResponse.json(
          { error: `Slot ${workshopOrder} is already taken by another meeting.` },
          { status: 409 }
        );
      }
    }

    // Build the workshop metadata object
    const workshopMeta = {
      lead: body.meta_lead ?? '',
      format: body.meta_format ?? '',
      workshopStatus: body.meta_workshop_status ?? '',
      workshopType: body.meta_workshop_type ?? '',
      capacity: body.meta_capacity ?? '',
    };

    await db`
      UPDATE threads SET
        show_on_workshops_page = ${showOnPage},
        workshop_order         = ${workshopOrder},
        subtitle               = ${body.subtitle ?? null},
        card_colour            = ${body.card_colour ?? null},
        card_accent_colour     = ${body.card_accent_colour ?? null},
        meeting_url            = ${body.meeting_url ?? null},
        metadata               = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('workshop', ${db.json(workshopMeta)}),
        updated_at             = NOW()
      WHERE kind = 'meeting' AND id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update workshop';
    console.error('Error updating workshop:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

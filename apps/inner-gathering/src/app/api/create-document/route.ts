import { NextRequest, NextResponse } from 'next/server';
import { createCollaborativeDocument } from '@elkdonis/services';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, meetingTitle, meetingId } = body;

    if (!orgId || !meetingTitle || !meetingId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await createCollaborativeDocument(
      orgId,
      meetingTitle,
      meetingId
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to create document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      url: result.url,
      editUrl: result.editUrl,
      shareToken: result.shareToken,
    });
  } catch (error) {
    console.error('[API] Error creating document:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

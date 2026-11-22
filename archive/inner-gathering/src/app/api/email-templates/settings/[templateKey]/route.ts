import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import {
  EMAIL_TEMPLATE_ORG_ID,
  cleanTemplateConfig,
  getEmailTemplateSettings,
  saveEmailTemplateSettings,
} from "@/lib/email-template-settings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ templateKey: string }> }
) {
  try {
    const { templateKey } = await params;
    const settings = await getEmailTemplateSettings(EMAIL_TEMPLATE_ORG_ID, templateKey);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[email-templates] settings load failed:", error);
    return NextResponse.json({ error: "Failed to load email template settings" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateKey: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    const { templateKey } = await params;
    const body = await request.json();
    const settings = await saveEmailTemplateSettings({
      orgId: EMAIL_TEMPLATE_ORG_ID,
      templateKey,
      config: cleanTemplateConfig(body.config ?? body),
      userId: session.user.id,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[email-templates] settings save failed:", error);
    return NextResponse.json({ error: "Failed to save email template settings" }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getApiEditor } from "@/lib/auth";
import { getThreadMaterials } from "@/lib/data";
import {
  MEETING_EMAIL_TEMPLATE_KEY,
  cleanTemplateConfig,
  getEmailTemplateSettingsForThread,
  saveEmailTemplateSettings,
  threadTemplateKey,
} from "@/lib/email-template-settings";
import { siteConfig } from "@/config/site";

/** The Write tab's load/save endpoint -- one config per thread, shared across confirmation/trigger/reminder sends. */

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const [settings, materials] = await Promise.all([
    getEmailTemplateSettingsForThread(siteConfig.orgId, MEETING_EMAIL_TEMPLATE_KEY, id),
    getThreadMaterials(id),
  ]);
  return NextResponse.json({ config: settings?.config ?? {}, materials });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  const settings = await saveEmailTemplateSettings({
    orgId: siteConfig.orgId,
    templateKey: threadTemplateKey(MEETING_EMAIL_TEMPLATE_KEY, id),
    config: cleanTemplateConfig(body.config ?? body),
    userId: editor.userId,
  });

  return NextResponse.json({ config: settings.config });
}

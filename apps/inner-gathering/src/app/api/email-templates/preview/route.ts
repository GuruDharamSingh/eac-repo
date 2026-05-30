import { NextRequest, NextResponse } from "next/server";
import {
  renderRsvpOwnerEmail,
  renderNewsletterEmail,
  renderWelcomeEmail,
  type EmailLinkItem,
  type EmailMediaItem,
} from "@elkdonis/email";

function cleanLinks(value: unknown): EmailLinkItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      label: typeof item?.label === "string" ? item.label.trim() : "",
      url: typeof item?.url === "string" ? item.url.trim() : "",
    }))
    .filter((item) => item.label && item.url);
}

function cleanMedia(value: unknown): EmailMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      url: typeof item?.url === "string" ? item.url.trim() : "",
      alt: typeof item?.alt === "string" ? item.alt.trim() : undefined,
      caption: typeof item?.caption === "string" ? item.caption.trim() : undefined,
    }))
    .filter((item) => item.url);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.templateKey === "welcome") {
      const html = await renderWelcomeEmail({
        displayName: body.displayName || "New Member",
        portalUrl: body.portalUrl || "http://localhost:3004/feed?welcome=1",
        bodyText: body.bodyText || undefined,
        links: Array.isArray(body.links) ? cleanLinks(body.links) : undefined,
        media: Array.isArray(body.media) ? cleanMedia(body.media) : undefined,
      });

      return NextResponse.json({ html });
    }

    if (body.templateKey === "newsletter") {
      const html = await renderNewsletterEmail({
        title: body.newsletterTitle || "A Letter From The Collective",
        previewText: body.previewText || "Updates, invitations, and notes from Elkdonis Arts Collective.",
        bodyText: body.bodyText || undefined,
        links: cleanLinks(body.links),
        media: cleanMedia(body.media),
      });

      return NextResponse.json({ html });
    }

    const html = await renderRsvpOwnerEmail({
      guestName: body.guestName || "Justin Gillis",
      guestEmail: body.guestEmail || "justin.gillisb@gmail.com",
      meetingTitle: body.meetingTitle || "Our Meeting",
      scheduledAt: body.scheduledAt || undefined,
      rsvpCreatedAt: body.rsvpCreatedAt || new Date().toISOString(),
      threadUrl: body.threadUrl || "http://localhost:3004/meetings/our-meeting",
      orgName: body.orgName || "Inner Gathering",
      rsvpCount: Number.isFinite(Number(body.rsvpCount)) ? Number(body.rsvpCount) : 1,
      bodyText: body.bodyText || undefined,
      links: cleanLinks(body.links),
      media: cleanMedia(body.media),
    });

    return NextResponse.json({ html });
  } catch (error) {
    console.error("[email-templates] preview failed:", error);
    return NextResponse.json({ error: "Failed to render email preview" }, { status: 500 });
  }
}

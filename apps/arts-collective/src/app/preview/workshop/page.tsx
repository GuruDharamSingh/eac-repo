import fs from "fs";
import path from "path";
import { renderWorkshopTemplate, readWorkshopCss } from "@/lib/cms/workshop-render";
import { getThreadWithWorkshopPage, getOrgBySlug } from "@/lib/org";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workshop Preview — EAC",
};

// ─── Placeholder data for raw template preview ────────────────────────────────

const PLACEHOLDER: import("@elkdonis/cms-bindings").WorkshopPageData = {
  id: "preview",
  slug: "preview",
  title: "Writing as a Practice, Not a Product",
  body: "<p>This series approaches writing as a living practice — exploratory, embodied, and grounded in the present moment. Participants will move through prompts, response exercises, and group reflection across six weekly sessions.</p>",
  scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  duration_minutes: 180,
  location: "EAC Studio, Toronto",
  format: "in_person",
  attendee_limit: 12,
  price: 180,
  currency: "CAD",
  sessions: [
    { id: "s1", title: "Opening circle — arriving in language", scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 180 },
    { id: "s2", title: "The body as archive", scheduled_at: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 180 },
  ],
  subtitle: "A 6-week series",
  description_short: "Exploratory, embodied writing practice for all levels.",
  discipline: "Creative writing",
  series_label: "Spring 2026",
  level: "all_levels",
  language: "English",
  session_count: 6,
  session_duration_hrs: 3,
  recurrence_label: "Saturdays 10am–1pm",
  location_address: "123 Queen St W, Toronto, ON",
  accessibility_notes: null,
  price_sliding_min: 90,
  price_member: 140,
  sliding_scale_note: "Reach out if cost is a barrier — no questions asked.",
  registration_url: "#register",
  registration_deadline: null,
  registration_status: "open",
  author_note: null,
  cover_image_url: null,
  gallery_image_urls: null,
  promo_video_url: null,
  optional_sections: {},
  facilitator_name: "Dana Kuroda",
  facilitator_bio: "Dana's practice spans poetry, auto-fiction, and collaborative writing. She has facilitated workshops at Harbourfront Centre and OCAD University.",
  facilitator_photo: null,
  facilitator_pronouns: "she/her",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WorkshopPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; org?: string }>;
}) {
  const { slug, org: orgSlug } = await searchParams;

  let data: import("@elkdonis/cms-bindings").WorkshopPageData = PLACEHOLDER;
  let isLive = false;

  if (slug && orgSlug) {
    const org = await getOrgBySlug(orgSlug);
    if (org) {
      const live = await getThreadWithWorkshopPage(org.id, slug);
      if (live) {
        data = live;
        isLive = true;
      }
    }
  }

  const css = readWorkshopCss();
  const html = renderWorkshopTemplate(data);

  return (
    <>
      {/* biome-ignore lint: workshop template CSS is trusted static content */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          background: "rgba(15,23,42,0.9)",
          color: "rgba(255,255,255,0.7)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "6px 12px",
          borderRadius: 6,
          border: "0.5px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(8px)",
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
        }}
      >
        EAC Workshop · {isLive ? `${data.title}` : "Template Preview"}
      </div>

      {/* biome-ignore lint: workshop template HTML is sanitized server-side */}
      <div className="eac-ws-page" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

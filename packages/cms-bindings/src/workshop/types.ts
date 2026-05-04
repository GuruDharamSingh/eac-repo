export type WorkshopSession = {
  id?: string;
  title?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  location?: string;
  meeting_url?: string;
};

export type GalleryImage = {
  url: string;
  alt?: string;
  caption?: string;
};

/**
 * All data needed to render a workshop page template.
 * Combines fields from: threads, workshop_pages, artist_profiles.
 *
 * This is the canonical contract between the CMS data layer and the
 * template rendering layer. Any consumer (arts-collective, inner-gathering,
 * future apps) should hydrate this type before calling renderWorkshopTemplate.
 */
export type WorkshopPageData = {
  // From threads
  id: string;
  slug: string;
  title: string;
  body: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: "in_person" | "online" | "hybrid" | null;
  attendee_limit: number | null;
  price: string | number | null;
  currency: string | null;
  sessions: WorkshopSession[] | null;

  // From workshop_pages (null when sidecar row not yet created)
  subtitle: string | null;
  description_short: string | null;
  discipline: string | null;
  series_label: string | null;
  level: string | null;
  language: string | null;
  session_count: number | null;
  session_duration_hrs: number | null;
  recurrence_label: string | null;
  location_address: string | null;
  accessibility_notes: string | null;
  price_sliding_min: number | null;
  price_member: number | null;
  sliding_scale_note: string | null;
  registration_url: string | null;
  registration_deadline: string | null;
  registration_status: string | null;
  author_note: string | null;
  cover_image_url: string | null;
  gallery_image_urls: GalleryImage[] | null;
  promo_video_url: string | null;
  optional_sections: Record<string, boolean> | null;

  // From artist_profiles (author)
  facilitator_name: string | null;
  facilitator_bio: string | null;
  facilitator_photo: string | null;
  facilitator_pronouns: string | null;
};

/**
 * Pre-read HTML strings for each workshop template section.
 * The caller (app) handles filesystem reading; this package handles rendering.
 */
export type WorkshopTemplates = {
  nav: string;
  hero: string;
  detailStrip: string;
  about: string;
  facilitator: string;
  schedule: string;
  gallery: string;
  testimonials: string;
  related: string;
  register: string;
};

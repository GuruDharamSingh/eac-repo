import { z } from "zod";

export const DISCIPLINE_VALUES = [
  "musician",
  "visual_artist",
  "writer",
  "performer",
  "tradesperson",
  "meditation",
  "yoga",
  "theater",
  "astrology",
] as const;

export const DISCIPLINE_LABELS: Record<(typeof DISCIPLINE_VALUES)[number], string> = {
  musician: "Musician",
  visual_artist: "Visual artist",
  writer: "Writer",
  performer: "Performer",
  tradesperson: "Tradesperson / maker",
  meditation: "Meditation",
  yoga: "Yoga",
  theater: "Theater",
  astrology: "Astrology",
};

export const EXPERIENCE_VALUES = ["starting_fresh", "established"] as const;

export const EXPERIENCE_LABELS: Record<(typeof EXPERIENCE_VALUES)[number], string> = {
  starting_fresh: "Starting fresh",
  established: "Established",
};

export const AUDIENCE_TYPE_VALUES = [
  "larger_budget",
  "online",
  "in_person",
  "casual_hobby",
  "performance",
  "service_business",
] as const;

export const AUDIENCE_TYPE_LABELS: Record<
  (typeof AUDIENCE_TYPE_VALUES)[number],
  string
> = {
  larger_budget: "Larger-budget clients",
  online: "Online audience",
  in_person: "In-person audience",
  casual_hobby: "Casual / hobby-based",
  performance: "Performance-based",
  service_business: "Service / business clients",
};

export const CLIENT_BASE_VALUES = [
  "art_enthusiasts",
  "domestic",
  "people_in_need",
] as const;

export const CLIENT_BASE_LABELS: Record<
  (typeof CLIENT_BASE_VALUES)[number],
  string
> = {
  art_enthusiasts: "Art enthusiasts",
  domestic: "Domestic / family audiences",
  people_in_need: "People in need",
};

export const GOALS_OPTION_VALUES = [
  "host_offerings",
  "connect_membership",
  "seek_service",
  "financial_success",
  "cross_promotion",
] as const;

export const GOALS_OPTION_LABELS: Record<
  (typeof GOALS_OPTION_VALUES)[number],
  string
> = {
  host_offerings: "Host my offerings on the web portal",
  connect_membership: "Connect with Elkdonis membership and expand",
  seek_service: "Be in contact with inspired, service-oriented people",
  financial_success: "Grow as an artist and earn a living",
  cross_promotion: "Cross-promote within artistic groups and subgroups",
};

export const NEED_VALUES = [
  "promotion",
  "funding",
  "artistic_ideas",
  "event_planning",
] as const;

export const NEED_LABELS: Record<(typeof NEED_VALUES)[number], string> = {
  promotion: "Help with promotion and audience reach",
  funding: "Funding or grants",
  artistic_ideas: "Artistic ideas or creative direction",
  event_planning: "Event planning support",
};

export const FEATURE_VALUES = [
  "events",
  "newsletter",
  "blog",
  "radio",
  "shop",
  "custom_emails",
] as const;

export const FEATURE_LABELS: Record<(typeof FEATURE_VALUES)[number], string> = {
  events: "Event pages & RSVPs",
  newsletter: "Newsletters to subscribers",
  blog: "Blog / articles",
  radio: "Radio / audio",
  shop: "Shop & trades",
  custom_emails: "Custom HTML emails",
};

export const TEMPLATE_VALUES = ["article", "event", "radio", "business"] as const;

export const TEMPLATE_LABELS: Record<(typeof TEMPLATE_VALUES)[number], { title: string; blurb: string }> = {
  article: {
    title: "Article-first",
    blurb: "Your page leads with long-form writing — essays, interviews, field notes.",
  },
  event: {
    title: "Event-first",
    blurb: "Your page leads with upcoming gatherings, performances, and workshops.",
  },
  radio: {
    title: "Radio / audio",
    blurb: "Your page centres on recorded audio — shows, sets, sermons, interviews.",
  },
  business: {
    title: "Trades & business",
    blurb: "Your page leads with services, availability, and commissions.",
  },
};

// -----------------------------------------------------------------------------
// Per-step Zod schemas (all fields optional because the wizard is resumable)
// -----------------------------------------------------------------------------

export const step1Schema = z.object({
  displayName: z.string().min(2, "At least 2 characters").max(120),
  pronouns: z.string().max(40).optional().default(""),
  city: z.string().min(1, "Where are you based?").max(120),
  bio: z.string().min(1, "Tell us a bit about yourself").max(800),
  photoUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .default(""),
});

export const step2Schema = z.object({
  disciplines: z.array(z.enum(DISCIPLINE_VALUES)).min(1, "Pick at least one"),
  disciplinesOther: z.string().max(200).optional().default(""),
  experienceLevel: z.enum(EXPERIENCE_VALUES),
});

export const step3Schema = z.object({
  portfolioUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .default(""),
  audienceTypes: z.array(z.enum(AUDIENCE_TYPE_VALUES)).default([]),
  clientBase: z.array(z.enum(CLIENT_BASE_VALUES)).default([]),
  audienceDescription: z.string().max(800).optional().default(""),
});

export const step4Schema = z.object({
  goalsOptions: z.array(z.enum(GOALS_OPTION_VALUES)).default([]),
  goalsNote: z.string().max(800).optional().default(""),
  mutualAidMedia: z.boolean().default(false),
  mutualAidAuthoring: z.boolean().default(false),
});

export const step5Schema = z.object({
  personalPhilosophy: z.string().max(1200).optional().default(""),
  aestheticKeywords: z.array(z.string().max(50)).max(12).default([]),
  aestheticNotes: z.string().max(800).optional().default(""),
});

export const step6Schema = z.object({
  needs: z.array(z.enum(NEED_VALUES)).default([]),
  needsNote: z.string().max(600).optional().default(""),
});

export const step7Schema = z.object({
  featuresRequested: z.array(z.enum(FEATURE_VALUES)).default([]),
  featuresOther: z.string().max(600).optional().default(""),
});

export const step8Schema = z.object({
  templatePreference: z.enum(TEMPLATE_VALUES),
  palettePreference: z.string().max(80).optional().default(""),
});

export const wizardSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .merge(step7Schema)
  .merge(step8Schema);

export type WizardAnswers = z.infer<typeof wizardSchema>;

export const TOTAL_STEPS = 8;

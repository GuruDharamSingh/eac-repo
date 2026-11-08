// The Services kind's shapes, shared by the client kind and its server actions.
// Number fields are strings, as the inputs hold them; serviceFormSchema
// (lib/cms/schema.ts) turns them into numbers on save.

export type ServiceSummary = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  coverImageUrl: string | null;
  updatedAt: string;
};

export type ServiceDraft = {
  /** Null until the first save. */
  id: string | null;
  slug: string | null;
  title: string;
  subtitle: string;
  /** The card line (threads.excerpt); derived from the body when blank. */
  summary: string;
  /** HTML. */
  body: string;
  coverImageUrl: string;
  bookingType: "one_on_one" | "group" | "async";
  format: "in_person" | "online" | "hybrid";
  price: string;
  currency: string;
  slidingScale: boolean;
  priceSlidingMin: string;
  slidingScaleNote: string;
  durationMinutes: string;
  sessionCount: string;
  location: string;
  registrationStatus: "open" | "waitlist" | "full" | "closed";
  visibility: "PUBLIC" | "ORGANIZATION";
  status: "draft" | "published";
  feedSlug: string;
};

export function blankService(): ServiceDraft {
  return {
    id: null,
    slug: null,
    title: "",
    subtitle: "",
    summary: "",
    body: "",
    coverImageUrl: "",
    bookingType: "one_on_one",
    format: "online",
    price: "",
    currency: "CAD",
    slidingScale: false,
    priceSlidingMin: "",
    slidingScaleNote: "",
    durationMinutes: "60",
    sessionCount: "",
    location: "",
    registrationStatus: "open",
    visibility: "PUBLIC",
    status: "draft",
    feedSlug: "services",
  };
}

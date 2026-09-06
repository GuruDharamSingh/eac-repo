import type { ServiceOffering } from "@elkdonis/services";
import type { Thread } from "@/lib/types";

/**
 * Local form state — every numeric field is a string, because that's what an
 * <input type="number"> produces. The schema's reqNum/optNum coerce these back
 * to numbers on submit (same split as amrit-canada's ContentFormDefaults).
 */
export interface ContentFormDefaults {
  kind: "post" | "service";
  feedSlug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  visibility: "PUBLIC" | "ORGANIZATION";

  // service only
  subtitle: string;
  bookingType: "one_on_one" | "group" | "async";
  format: "in_person" | "online" | "hybrid" | "";
  price: string;
  currency: string;
  slidingScale: boolean;
  priceSlidingMin: string;
  slidingScaleNote: string;
  sessionCount: string;
  sessionDurationHrs: string;
  recurrenceLabel: string;
  location: string;
  bannerImageUrl: string;
  registrationStatus: "open" | "waitlist" | "full" | "closed";
}

export function emptyDefaults(feedSlug: string): ContentFormDefaults {
  return {
    kind: feedSlug === "services" ? "service" : "post",
    feedSlug,
    title: "",
    excerpt: "",
    body: "",
    coverImageUrl: "",
    visibility: "PUBLIC",

    subtitle: "",
    bookingType: "one_on_one",
    format: "",
    price: "",
    currency: "CAD",
    slidingScale: false,
    priceSlidingMin: "",
    slidingScaleNote: "",
    sessionCount: "",
    sessionDurationHrs: "",
    recurrenceLabel: "",
    location: "",
    bannerImageUrl: "",
    registrationStatus: "open",
  };
}

/** A post being edited. Service fields fall back to their empty defaults. */
export function threadToDefaults(thread: Thread): ContentFormDefaults {
  return {
    ...emptyDefaults(thread.feedSlug ?? "writing"),
    kind: "post",
    title: thread.title,
    excerpt: thread.excerpt ?? "",
    body: thread.description ?? "",
    coverImageUrl: thread.coverImageUrl ?? "",
    visibility: thread.visibility === "PUBLIC" ? "PUBLIC" : "ORGANIZATION",
  };
}

export function serviceToDefaults(service: ServiceOffering): ContentFormDefaults {
  return {
    ...emptyDefaults(service.section ?? "services"),
    kind: "service",
    title: service.title,
    excerpt: service.descriptionShort ?? "",
    body: service.body ?? "",
    coverImageUrl: service.coverImageUrl ?? "",
    visibility: service.visibility === "PUBLIC" ? "PUBLIC" : "ORGANIZATION",

    subtitle: service.subtitle ?? "",
    bookingType: service.bookingType ?? "one_on_one",
    format: service.format ?? "",
    price: service.price != null ? String(service.price) : "",
    currency: service.currency,
    slidingScale: service.priceSlidingMin != null,
    priceSlidingMin: service.priceSlidingMin != null ? String(service.priceSlidingMin) : "",
    slidingScaleNote: service.slidingScaleNote ?? "",
    sessionCount: service.sessionCount != null ? String(service.sessionCount) : "",
    sessionDurationHrs:
      service.sessionDurationHrs != null ? String(service.sessionDurationHrs) : "",
    recurrenceLabel: service.recurrenceLabel ?? "",
    location: service.location ?? "",
    bannerImageUrl: service.bannerImageUrl ?? "",
    registrationStatus: service.registrationStatus,
  };
}

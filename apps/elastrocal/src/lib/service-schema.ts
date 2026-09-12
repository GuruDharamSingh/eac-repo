import { z } from "zod";

/** A service offering as the hub form sends it. Shared by the form (client) and the action (server). */
export const serviceSchema = z.object({
  title: z.string().trim().min(1, "Give the service a title").max(200),
  subtitle: z.string().trim().max(200).optional(),
  descriptionShort: z.string().trim().max(300).optional(),
  body: z.string().trim().max(20_000).optional(),
  bookingType: z.enum(["one_on_one", "group", "async"]),
  format: z.enum(["in_person", "online", "hybrid"]).optional(),
  price: z.coerce.number().min(0, "Price can't be negative").max(100_000),
  currency: z.string().trim().length(3).default("CAD"),
  priceSlidingMin: z.coerce.number().min(0).max(100_000).optional(),
  slidingScaleNote: z.string().trim().max(300).optional(),
  sessionDurationHrs: z.coerce.number().min(0).max(100).optional(),
  recurrenceLabel: z.string().trim().max(120).optional(),
  location: z.string().trim().max(200).optional(),
  registrationStatus: z.enum(["open", "waitlist", "full", "closed"]).default("open"),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type ServiceFormInput = z.input<typeof serviceSchema>;

import { z } from "zod";
import { HOUSE_SYSTEMS, isValidTimeZone, type HouseSystemCode } from "@elkdonis/astro";

const houseSystemCodes = HOUSE_SYSTEMS.map((h) => h.code) as [HouseSystemCode, ...HouseSystemCode[]];

/** Birth data as the calculator form sends it. */
const birthFields = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date is required"),
  // Optional only when timeKnown is false; then local noon is used.
  time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Birth time is required").optional(),
  timeKnown: z.boolean().default(true),
  timezone: z.string().min(1).max(64).refine(isValidTimeZone, "Unknown time zone"),
  latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  houseSystem: z.enum(houseSystemCodes).default("P"),
  locationName: z.string().trim().max(300).optional(),
};

/**
 * Resolves the time: required when known, local noon when not. Applied to
 * every schema that carries birth fields, so `time` is always a string after
 * parsing.
 */
function withResolvedTime<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .superRefine((v, ctx) => {
      if (v.timeKnown && !v.time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Birth time is required", path: ["time"] });
      }
    })
    .transform((v) => ({ ...v, time: v.timeKnown ? (v.time as string) : "12:00" }));
}

export const birthDataSchema = withResolvedTime(birthFields);
export type BirthData = z.infer<typeof birthDataSchema>;

export const saveChartSchema = withResolvedTime({
  ...birthFields,
  name: z.string().trim().min(1, "Give the chart a name").max(200),
  isFavorite: z.boolean().default(false),
});

export const updateChartSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    isFavorite: z.boolean(),
    notes: z.string().max(10_000).nullable(),
  })
  .partial();

/** First issue as a sentence, for the form's error line. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

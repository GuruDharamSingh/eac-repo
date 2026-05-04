import { z } from "zod";

/**
 * NOTE: The complex collective governance schema is preserved here as a reference 
 * for internal/advanced members. 
 * 
 * Previous complex fields included:
 * - revenueSharingModel (equal_split, contribution_based, tiered, etc.)
 * - primaryDecisionMethod (consensus, super_majority, sociocracy, etc.)
 * - adminLoadRotation, financialTransparencyAccess, etc.
 */

// --- Section 1: The Creative Entity ---
export const ENTITY_TYPE_VALUES = ["individual", "registered_business", "collective"] as const;
export const ENTITY_TYPE_LABELS: Record<(typeof ENTITY_TYPE_VALUES)[number], string> = {
  individual: "Individual",
  registered_business: "Registered Business",
  collective: "Collective",
};

export const LEGAL_STATUS_VALUES = ["sole_prop", "llc", "just_starting"] as const;
export const LEGAL_STATUS_LABELS: Record<(typeof LEGAL_STATUS_VALUES)[number], string> = {
  sole_prop: "Sole Proprietorship",
  llc: "LLC",
  just_starting: "Just starting / Not yet registered",
};

// --- Section 2: Offerings & Value ---
export const REVENUE_STREAM_VALUES = ["physical_art", "digital_goods", "commissions", "workshops"] as const;
export const REVENUE_STREAM_LABELS: Record<(typeof REVENUE_STREAM_VALUES)[number], string> = {
  physical_art: "Physical Art",
  digital_goods: "Digital Goods",
  commissions: "Commissions",
  workshops: "Workshops / Teaching",
};

export const PRICING_VALUES = ["materials_plus_labor", "value_based", "sliding_scale"] as const;
export const PRICING_LABELS: Record<(typeof PRICING_VALUES)[number], string> = {
  materials_plus_labor: "Materials plus Labor",
  value_based: "Value-based Pricing",
  sliding_scale: "Sliding Scale (Mutual Aid model)",
};

// --- Section 3: Logistics ---
export const FULFILLMENT_VALUES = ["self", "third_party", "collective_support"] as const;
export const FULFILLMENT_LABELS: Record<(typeof FULFILLMENT_VALUES)[number], string> = {
  self: "I handle it myself",
  third_party: "Third-party service (e.g. 3PL)",
  collective_support: "Looking for collective support",
};

// --- Section 4: Collective Cohesion ---
export const RESOURCE_HELP_VALUES = ["insurance", "marketing", "bulk_materials", "workspace"] as const;
export const RESOURCE_HELP_LABELS: Record<(typeof RESOURCE_HELP_VALUES)[number], string> = {
  insurance: "Shared Insurance",
  marketing: "Joint Marketing",
  bulk_materials: "Bulk Material Discounts",
  workspace: "Shared Workspace",
};

// --- Zod Schemas ---

export const bizStep1Schema = z.object({
  entityType: z.enum(ENTITY_TYPE_VALUES),
  entityName: z.string().max(120).optional().default(""),
  mission: z.string().max(800).optional().default(""),
  legalStatus: z.enum(LEGAL_STATUS_VALUES),
});

export const bizStep2Schema = z.object({
  primaryRevenue: z.array(z.enum(REVENUE_STREAM_VALUES)).min(1, "Pick at least one"),
  capacity: z.string().max(200).optional().default(""),
  pricingPhilosophy: z.enum(PRICING_VALUES),
});

export const bizStep3Schema = z.object({
  tools: z.string().max(200).optional().default(""),
  fulfillment: z.enum(FULFILLMENT_VALUES),
  inventoryManagement: z.string().max(800).optional().default(""),
});

export const bizStep4Schema = z.object({
  desiredResources: z.array(z.enum(RESOURCE_HELP_VALUES)).default([]),
  revenueSharing: z.string().max(100).optional().default(""),
  skillShare: z.string().max(800).optional().default(""),
});

export const bizStep5Schema = z.object({
  mainBarrier: z.string().max(800).optional().default(""),
  revenueGoal: z.string().max(100).optional().default(""),
});

export const businessWizardSchema = bizStep1Schema
  .merge(bizStep2Schema)
  .merge(bizStep3Schema)
  .merge(bizStep4Schema)
  .merge(bizStep5Schema);

export type BusinessWizardAnswers = z.infer<typeof businessWizardSchema>;

export const BIZ_TOTAL_STEPS = 5;

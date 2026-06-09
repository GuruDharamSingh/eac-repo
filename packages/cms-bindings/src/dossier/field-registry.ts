import type { FieldInputType } from "../workshop/field-registry";

/**
 * Field metadata for dossier traits. Mirrors the workshop `FieldMeta` shape but
 * its `table` is fixed to `directory_profiles`, so the workshop `FieldTable`
 * union (and its exhaustive consumers) stays untouched.
 */
export interface DossierFieldMeta {
  label: string;
  input: FieldInputType;
  table: "directory_profiles";
  col: string;
  dataKey?: string;
  hint?: string;
}

/**
 * Maps every data-trait value used in the dossier-classified template to its
 * source column on `directory_profiles`. Consumed by the live editor
 * (EditOverlay / FieldPopover) and the dossier field-update server action.
 */
export const dossierFieldRegistry: Record<string, DossierFieldMeta> = {
  archiveName: {
    label: "Archive Name",
    input: "text",
    table: "directory_profiles",
    col: "org_id",
    hint: "Network/archive label shown in the nav (not per-profile)",
  },
  aliasName: {
    label: "Subject Name",
    input: "text",
    table: "directory_profiles",
    col: "name",
    hint: "Headline name on the dossier",
  },
  occupation: {
    label: "Occupation",
    input: "text",
    table: "directory_profiles",
    col: "role",
    hint: "Discipline / role line",
  },
  location: {
    label: "Location",
    input: "text",
    table: "directory_profiles",
    col: "location",
    hint: "City / region, e.g. 'Chicago, IL'",
  },
  status: {
    label: "File Status / Stamp",
    input: "text",
    table: "directory_profiles",
    col: "dossier_status",
    hint: "The stamped status. Also reflects claim state.",
  },
  bioNotes: {
    label: "Notes (bio)",
    input: "textarea",
    table: "directory_profiles",
    col: "bio",
    hint: "The NOTES paragraph in the identity block",
  },
  photoUrl: {
    label: "Subject Photo",
    input: "image",
    table: "directory_profiles",
    col: "portrait_url",
    hint: "Paperclip profile photo",
  },
  operationsList: {
    label: "Known Operations",
    input: "compound",
    table: "directory_profiles",
    col: "operations",
    hint: "JSONB array of projects/artifacts: title, date, details, image_url",
  },
  currentTargets: {
    label: "Current Surveillance Targets",
    input: "textarea",
    table: "directory_profiles",
    col: "current_targets",
    hint: "In-progress work — one item per line",
  },
  projectedMovements: {
    label: "Projected Movements",
    input: "textarea",
    table: "directory_profiles",
    col: "projected_movements",
    hint: "Upcoming plans — one item per line",
  },
  verifiedContacts: {
    label: "Verified Contacts",
    input: "textarea",
    table: "directory_profiles",
    col: "verified_contacts",
    hint: "Confirmed collaborators — one per line",
  },
  wantedAccomplices: {
    label: "Wanted Accomplices",
    input: "textarea",
    table: "directory_profiles",
    col: "wanted_accomplices",
    hint: "Roles/collaborators sought — one per line",
  },
  financialChannels: {
    label: "Financial Channels",
    input: "compound",
    table: "directory_profiles",
    col: "financial_channels",
    hint: "JSONB array of support links: title, description, url",
  },
};

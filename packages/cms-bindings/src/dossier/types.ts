/**
 * Canonical data contract for the "Classified Artist Dossier" template
 * (connector template: dossier-classified). Hydrated from directory_profiles
 * by any consumer (arts-collective OAD, IFAC, future apps) before rendering.
 */

export type DossierOperation = {
  title: string;
  date?: string | null;
  details?: string | null;
  image_url?: string | null;
};

export type DossierChannel = {
  title: string;
  description?: string | null;
  url: string;
};

export type DossierProfileData = {
  slug: string;
  /** aliasName — headline subject name */
  name: string;
  /** occupation line */
  occupation: string | null;
  /** "Chicago, IL (Last Known)" */
  location: string | null;
  /** STATUS line, e.g. "ACTIVE — MONITOR CLOSELY" */
  dossier_status: string | null;
  /** NOTES paragraph(s) */
  bio: string | null;
  /** paperclip profile photo */
  photo_url: string | null;
  /** KNOWN OPERATIONS — projects / artifacts */
  operations: DossierOperation[];
  /** INTELLIGENCE: current surveillance targets (in-progress work) */
  current_targets: string[];
  /** INTELLIGENCE: projected movements (upcoming) */
  projected_movements: string[];
  /** NETWORK: verified contacts */
  verified_contacts: string[];
  /** NETWORK: wanted accomplices (seeking) */
  wanted_accomplices: string[];
  /** FINANCIAL CHANNELS: support links */
  financial_channels: DossierChannel[];
  /** Stamp + claim flow: 'unclaimed' | 'pending' | 'claimed' */
  claim_status: "unclaimed" | "pending" | "claimed";
  verified: boolean;
  /** Secure comm link target (mailto: or url) for the identity CTA */
  contact_href?: string | null;
};

/** Pre-read HTML strings for each dossier template section. */
export type DossierTemplates = {
  nav: string;
  identity: string;
  operations: string;
  intelligence: string;
  network: string;
  funds: string;
};

import type { DossierProfileData, DossierOperation, DossierChannel } from "./types";
import {
  setTextTrait,
  setDivTrait,
  setHrefTrait,
  setSrcTrait,
} from "../workshop/render";

// ─── escaping ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function stampLabel(data: Pick<DossierProfileData, "claim_status" | "verified">): string {
  if (data.verified) return "VERIFIED";
  if (data.claim_status === "claimed") return "CLAIMED";
  if (data.claim_status === "pending") return "PENDING";
  return "UNCLAIMED";
}

// ─── section builders (generative — match dossier-classified CSS classes) ─────

export function buildDossierNav(archiveName = "Mutual Aid Archive"): string {
  return `<nav class="eac-dossier-nav" data-gjs-type="eac-dossier-nav">
  <div class="eac-dossier-nav-brand" data-trait="archiveName">${esc(archiveName)}</div>
  <div class="eac-dossier-nav-controls">
    <input type="text" class="eac-dossier-nav-search" placeholder="Query Directory..." data-trait="placeholderText">
    <a href="/directory" class="eac-dossier-nav-link">Index</a>
  </div>
</nav>`;
}

export function buildDossierIdentity(data: DossierProfileData): string {
  const photo = data.photo_url || "https://placehold.co/300x375/e4cc9a/1a1a1a?text=NO+PHOTO";
  const commHref = data.contact_href || "#";
  return `<div class="eac-dossier-identity" data-gjs-type="eac-dossier-identity">
  <div class="eac-dos-stamp" data-trait="status">${esc(stampLabel(data))}</div>
  <div class="eac-dos-header-block">
    <div class="eac-dos-profile-container">
      <img src="${escAttr(photo)}" alt="${escAttr(data.name)}" class="eac-dos-profile-pic" data-trait="photoUrl">
    </div>
    <div class="eac-dos-header-content">
      <h1 class="eac-dos-alias" data-trait="aliasName">${esc(data.name)}</h1>
      <div class="eac-dos-form-row">
        <span class="eac-dos-label">OCCUPATION:</span>
        <span class="eac-dos-value" data-trait="occupation">${esc(data.occupation || "—")}</span>
      </div>
      <div class="eac-dos-form-row">
        <span class="eac-dos-label">LOCATION:</span>
        <span class="eac-dos-value" data-trait="location">${esc(data.location || "Location withheld")}</span>
      </div>
      <div class="eac-dos-form-row">
        <span class="eac-dos-label">FILE STATUS:</span>
        <span class="eac-dos-value">${esc(data.dossier_status || stampLabel(data))}</span>
      </div>
      <div class="eac-dos-bio" data-trait="bioNotes"><strong>NOTES:</strong> ${esc(data.bio || "No intelligence on file.")}</div>
      <div class="eac-dos-actions">
        <a href="${escAttr(commHref)}" class="eac-dos-btn">SECURE COMM LINK</a>
      </div>
    </div>
  </div>
</div>`;
}

export function buildOperationsHtml(operations: DossierOperation[]): string {
  if (operations.length === 0) return "";
  const cards = operations
    .map((op) => {
      const img = op.image_url
        ? `<img src="${escAttr(op.image_url)}" alt="${escAttr(op.title)}" class="eac-dos-work-img">`
        : "";
      const date = op.date ? `<p><strong>DATE:</strong> ${esc(op.date)}</p>` : "";
      const details = op.details ? `<p><strong>DETAILS:</strong> ${esc(op.details)}</p>` : "";
      return `    <div class="eac-dos-work-card">
      ${img}
      <div class="eac-dos-work-info">
        <h3>${esc(op.title)}</h3>
        ${date}
        ${details}
      </div>
    </div>`;
    })
    .join("\n");
  return `<div class="eac-dossier-operations" data-gjs-type="eac-dossier-operations">
  <h2 class="eac-dos-section-title eac-dos-title-plain">KNOWN OPERATIONS</h2>
  <div class="eac-dos-works-grid" data-trait="operationsList">
${cards}
  </div>
</div>`;
}

function statusList(items: string[]): string {
  return items.map((i) => `        <li>${esc(i)}</li>`).join("\n");
}

export function buildIntelligenceHtml(
  currentTargets: string[],
  projectedMovements: string[]
): string {
  if (currentTargets.length === 0 && projectedMovements.length === 0) return "";
  const current =
    currentTargets.length > 0
      ? `    <div class="eac-dos-status-section">
      <strong class="eac-dos-status-head">CURRENT SURVEILLANCE TARGETS:</strong>
      <ul class="eac-dos-status-list" data-trait="currentTargets">
${statusList(currentTargets)}
      </ul>
    </div>`
      : "";
  const projected =
    projectedMovements.length > 0
      ? `    <div class="eac-dos-status-section">
      <strong class="eac-dos-status-head">PROJECTED MOVEMENTS:</strong>
      <ul class="eac-dos-status-list" data-trait="projectedMovements">
${statusList(projectedMovements)}
      </ul>
    </div>`
      : "";
  return `<div class="eac-dossier-intelligence" data-gjs-type="eac-dossier-intelligence">
  <h2 class="eac-dos-section-title eac-dos-title-plain">INTELLIGENCE REPORT</h2>
  <div class="eac-dos-status-layout">
${[current, projected].filter(Boolean).join("\n")}
  </div>
</div>`;
}

function tags(items: string[], wanted: boolean): string {
  const cls = wanted ? "eac-dos-tag eac-dos-tag-wanted" : "eac-dos-tag";
  return items.map((i) => `      <span class="${cls}">${esc(i)}</span>`).join("\n");
}

export function buildNetworkHtml(
  verifiedContacts: string[],
  wantedAccomplices: string[]
): string {
  if (verifiedContacts.length === 0 && wantedAccomplices.length === 0) return "";
  const verified =
    verifiedContacts.length > 0
      ? `  <div class="eac-dos-network-block">
    <h3 class="eac-dos-network-sub">VERIFIED CONTACTS:</h3>
    <div class="eac-dos-tags-container" data-trait="verifiedContacts">
${tags(verifiedContacts, false)}
    </div>
  </div>`
      : "";
  const wanted =
    wantedAccomplices.length > 0
      ? `  <div class="eac-dos-network-block">
    <h3 class="eac-dos-network-sub">WANTED ACCOMPLICES:</h3>
    <div class="eac-dos-tags-container" data-trait="wantedAccomplices">
${tags(wantedAccomplices, true)}
    </div>
  </div>`
      : "";
  return `<div class="eac-dossier-network" data-gjs-type="eac-dossier-network">
  <h2 class="eac-dos-section-title">ASSOCIATES & INFORMANTS</h2>
${[verified, wanted].filter(Boolean).join("\n")}
</div>`;
}

export function buildFundsHtml(channels: DossierChannel[]): string {
  if (channels.length === 0) return "";
  const cards = channels
    .map(
      (c) => `    <a href="${escAttr(c.url)}" class="eac-dos-support-card" target="_blank" rel="noreferrer">
      <div class="eac-dos-support-info">
        <strong>${esc(c.title)}</strong>
        <span>${esc(c.description || "")}</span>
      </div>
      <span class="eac-dos-support-arrow">&#x2192;</span>
    </a>`
    )
    .join("\n");
  return `<div class="eac-dossier-funds" data-gjs-type="eac-dossier-funds">
  <h2 class="eac-dos-section-title">FINANCIAL CHANNELS</h2>
  <div class="eac-dos-support-grid" data-trait="financialChannels">
${cards}
  </div>
</div>`;
}

// ─── full page render (generative) ────────────────────────────────────────────

/**
 * Render a complete artist dossier from DB data. Optional sections are omitted
 * when empty (per the template manifest's omitWhenEmpty). Returns an HTML string
 * for dangerouslySetInnerHTML; the caller injects the dossier CSS.
 */
export function renderDossier(
  data: DossierProfileData,
  opts: { includeNav?: boolean; archiveName?: string } = {}
): string {
  const parts: string[] = [];
  if (opts.includeNav !== false) parts.push(buildDossierNav(opts.archiveName));
  parts.push(`<div class="eac-dossier-file">`);
  parts.push(buildDossierIdentity(data));
  parts.push(buildOperationsHtml(data.operations));
  parts.push(buildIntelligenceHtml(data.current_targets, data.projected_movements));
  parts.push(buildNetworkHtml(data.verified_contacts, data.wanted_accomplices));
  parts.push(buildFundsHtml(data.financial_channels));
  parts.push(`</div>`);
  return parts.filter(Boolean).join("\n");
}

// ─── Silex HTML binding ───────────────────────────────────────────────────────

/**
 * Bind dossier data into Silex-published HTML carrying data-trait slots. Mirror
 * of applyWorkshopTraits: scalar text/img slots are substituted in place, and
 * list/grid containers are wholesale-replaced with generated markup.
 */
export function applyDossierTraits(html: string, data: DossierProfileData): string {
  let h = html;

  // Identity scalars
  h = setTextTrait(h, "status", stampLabel(data));
  h = setTextTrait(h, "aliasName", data.name);
  h = setTextTrait(h, "occupation", data.occupation || "");
  h = setTextTrait(h, "location", data.location || "");
  h = setDivTrait(h, "bioNotes", `<strong>NOTES:</strong> ${esc(data.bio || "")}`);
  if (data.photo_url) h = setSrcTrait(h, "photoUrl", data.photo_url);
  if (data.contact_href) h = setHrefTrait(h, "commLink", data.contact_href);

  // Nav
  h = setTextTrait(h, "archiveName", "Mutual Aid Archive");

  // Operations grid
  if (data.operations.length > 0) {
    const cards = data.operations
      .map((op) => {
        const img = op.image_url
          ? `<img src="${escAttr(op.image_url)}" alt="${escAttr(op.title)}" class="eac-dos-work-img">`
          : "";
        const date = op.date ? `<p><strong>DATE:</strong> ${esc(op.date)}</p>` : "";
        const details = op.details ? `<p><strong>DETAILS:</strong> ${esc(op.details)}</p>` : "";
        return `<div class="eac-dos-work-card">${img}<div class="eac-dos-work-info"><h3>${esc(op.title)}</h3>${date}${details}</div></div>`;
      })
      .join("");
    h = setDivTrait(h, "operationsList", cards);
  }

  // Intelligence lists
  if (data.current_targets.length > 0) {
    h = h.replace(
      /(<ul\b[^>]*\bdata-trait="currentTargets"[^>]*>)[\s\S]*?(<\/ul>)/,
      `$1${data.current_targets.map((i) => `<li>${esc(i)}</li>`).join("")}$2`
    );
  }
  if (data.projected_movements.length > 0) {
    h = h.replace(
      /(<ul\b[^>]*\bdata-trait="projectedMovements"[^>]*>)[\s\S]*?(<\/ul>)/,
      `$1${data.projected_movements.map((i) => `<li>${esc(i)}</li>`).join("")}$2`
    );
  }

  // Network tags
  if (data.verified_contacts.length > 0) {
    h = setDivTrait(
      h,
      "verifiedContacts",
      data.verified_contacts.map((i) => `<span class="eac-dos-tag">${esc(i)}</span>`).join("")
    );
  }
  if (data.wanted_accomplices.length > 0) {
    h = setDivTrait(
      h,
      "wantedAccomplices",
      data.wanted_accomplices.map((i) => `<span class="eac-dos-tag eac-dos-tag-wanted">${esc(i)}</span>`).join("")
    );
  }

  // Financial channels
  if (data.financial_channels.length > 0) {
    const cards = data.financial_channels
      .map(
        (c) =>
          `<a href="${escAttr(c.url)}" class="eac-dos-support-card" target="_blank" rel="noreferrer"><div class="eac-dos-support-info"><strong>${esc(c.title)}</strong><span>${esc(c.description || "")}</span></div><span class="eac-dos-support-arrow">&#x2192;</span></a>`
      )
      .join("");
    h = setDivTrait(h, "financialChannels", cards);
  }

  return h;
}

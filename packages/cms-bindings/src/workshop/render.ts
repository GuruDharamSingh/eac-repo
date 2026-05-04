import type { WorkshopPageData, WorkshopTemplates, WorkshopSession } from "./types";
import {
  formatDate,
  formatTime,
  formatLevel,
  formatFormat,
  formatPrice,
  registrationCta,
  startsIn,
} from "./format";

// ─── HTML escaping ────────────────────────────────────────────────────────────

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

function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Trait injectors ──────────────────────────────────────────────────────────

/**
 * Replace the text content of leaf elements with `data-trait="name"`.
 * Safe for elements that don't self-nest (span, h1-h6, p, dd, dt, a, etc.).
 */
export function setTextTrait(html: string, trait: string, value: string): string {
  if (!value) return html;
  const tag = `(?:span|h1|h2|h3|h4|h5|h6|p|dd|dt|li|a|button|label)`;
  return html.replace(
    new RegExp(`(<${tag}\\b[^>]*\\bdata-trait="${reEsc(trait)}"[^>]*>)[\\s\\S]*?(<\\/${tag}>)`, "g"),
    `$1${esc(value)}$2`
  );
}

/**
 * Replace innerHTML of a div with `data-trait="name"`.
 * Avoid for divs with nested divs at the same depth.
 */
export function setDivTrait(html: string, trait: string, value: string): string {
  if (!value) return html;
  return html.replace(
    new RegExp(`(<div\\b[^>]*\\bdata-trait="${reEsc(trait)}"[^>]*>)[\\s\\S]*?(<\\/div>)`, "g"),
    (_, open, close) => `${open}${value}${close}`
  );
}

/** Replace the href attribute on anchors with `data-href-trait="name"`. */
export function setHrefTrait(html: string, trait: string, href: string): string {
  if (!href) return html;
  const safe = escAttr(href);
  let out = html.replace(
    new RegExp(`(data-href-trait="${reEsc(trait)}"[^>]*)\\bhref="[^"]*"`, "g"),
    `$1 href="${safe}"`
  );
  out = out.replace(
    new RegExp(`(\\bhref="[^"]*"[^>]*\\bdata-href-trait="${reEsc(trait)}")`, "g"),
    (match) => match.replace(/href="[^"]*"/, `href="${safe}"`)
  );
  return out;
}

/** Replace the src attribute on img elements with `data-trait="name"`. */
export function setSrcTrait(html: string, trait: string, src: string): string {
  if (!src) return html;
  const safe = escAttr(src);
  return html.replace(
    new RegExp(`(<img\\b[^>]*\\bdata-trait="${reEsc(trait)}"[^>]*\\bsrc=")[^"]*"`, "g"),
    `$1${safe}"`
  );
}

// ─── Section generators ───────────────────────────────────────────────────────

export function buildScheduleHtml(sessions: WorkshopSession[]): string {
  if (sessions.length === 0) return "";

  const items = sessions
    .map((s, i) => {
      const dateParts = formatDate(s.scheduled_at ?? null).split(" ");
      return `
    <li class="eac-ws-schedule__item">
      <div class="eac-ws-schedule__date">
        <span class="eac-ws-schedule__day">${esc(dateParts[0] ?? "")}</span>
        <span class="eac-ws-schedule__num">${esc(formatDate(s.scheduled_at ?? null))}</span>
      </div>
      <div class="eac-ws-schedule__content">
        <h3 class="eac-ws-schedule__title">${esc(s.title || `Session ${i + 1}`)}</h3>
        ${s.location ? `<p class="eac-ws-schedule__desc">${esc(s.location)}</p>` : ""}
      </div>
      <div class="eac-ws-schedule__time">${esc(formatTime(s.scheduled_at ?? null))}</div>
    </li>`;
    })
    .join("\n");

  return `<section class="eac-ws-schedule" data-gjs-type="eac-ws-schedule" id="schedule">
  <div class="eac-ws-schedule__inner">
    <span class="eac-ws-label eac-ws-label--schedule">schedule</span>
    <div class="eac-ws-schedule__header">
      <h2 class="eac-ws-schedule__heading">Session breakdown</h2>
    </div>
    <ol class="eac-ws-schedule__list">${items}</ol>
  </div>
</section>`;
}

export function buildGalleryHtml(
  images: { url: string; alt?: string }[],
  promoVideoUrl: string | null
): string {
  if (images.length === 0 && !promoVideoUrl) return "";

  const imgTags = images
    .slice(0, 4)
    .map(
      (img, i) =>
        `<div class="eac-ws-gallery__item${i === 0 ? " eac-ws-gallery__item--featured" : ""}">
          <img class="eac-ws-gallery__img" src="${escAttr(img.url)}" alt="${escAttr(img.alt ?? "Workshop session photo")}" loading="lazy">
        </div>`
    )
    .join("\n");

  const video = promoVideoUrl
    ? `<div class="eac-ws-gallery__video">
        <iframe class="eac-ws-gallery__iframe" src="${escAttr(promoVideoUrl)}" title="Workshop promo" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>`
    : "";

  return `<section class="eac-ws-gallery" data-gjs-type="eac-ws-gallery" id="gallery">
  <div class="eac-ws-gallery__inner">
    <span class="eac-ws-label eac-ws-label--media">media</span>
    <h2 class="eac-ws-gallery__heading">From past sessions</h2>
    <div class="eac-ws-gallery__grid">${imgTags}</div>
    ${video}
  </div>
</section>`;
}

// ─── Main render ──────────────────────────────────────────────────────────────

/**
 * Bind DB data into the workshop template HTML.
 *
 * Accepts pre-read HTML strings (caller handles filesystem). Returns the
 * complete rendered HTML string ready for `dangerouslySetInnerHTML` or
 * streaming to the client.
 *
 * Package consumers: arts-collective (Next.js SSR), inner-gathering (mobile
 * preview), future: a standalone workshop microsite export.
 */
export function renderWorkshopTemplate(
  data: WorkshopPageData,
  templates: WorkshopTemplates
): string {
  const optional = data.optional_sections ?? {};
  const sessions: WorkshopSession[] = Array.isArray(data.sessions) ? data.sessions : [];

  const eyebrow = [data.discipline, data.series_label].filter(Boolean).join(" · ");
  const locationName = data.location || data.location_address || "";
  const regUrl = data.registration_url || "#register";
  const ctaText = registrationCta(data.registration_status, data.price, data.currency);
  const priceFull = formatPrice(data.price, data.currency);
  const regDeadline = data.registration_deadline
    ? `Registration deadline: ${formatDate(data.registration_deadline)}`
    : "";
  const priceContext = data.session_count
    ? `/ ${data.session_count} session${data.session_count > 1 ? "s" : ""}`
    : "";
  const facilitatorBio = data.author_note || data.facilitator_bio || "";

  const parts: string[] = [];

  // ── Nav ────────────────────────────────────────────────────────────────────
  {
    let h = templates.nav;
    h = setTextTrait(h, "ctaLabel", "Stay in touch");
    h = setHrefTrait(h, "ctaHref", regUrl);
    parts.push(h);
  }

  // ── Hero ───────────────────────────────────────────────────────────────────
  {
    let h = templates.hero;
    h = setTextTrait(h, "eyebrowText", eyebrow);
    h = setTextTrait(h, "title", data.title);
    h = setTextTrait(h, "recurrence", data.recurrence_label || "");
    h = setTextTrait(h, "locationName", locationName);
    h = setTextTrait(h, "spotsText", data.attendee_limit ? `${data.attendee_limit} spots` : "");
    h = setTextTrait(h, "ctaLabel", ctaText);
    h = setHrefTrait(h, "registrationUrl", regUrl);
    if (data.cover_image_url) {
      h = h.replace(
        /class="eac-ws-hero__bg"/,
        `class="eac-ws-hero__bg" style="background-image:url('${escAttr(data.cover_image_url)}')"`
      );
    }
    parts.push(h);
  }

  // ── Detail strip ──────────────────────────────────────────────────────────
  {
    let h = templates.detailStrip;
    h = setTextTrait(h, "startDate", formatDate(data.scheduled_at));
    h = setTextTrait(h, "sessionCount", data.session_count ? `${data.session_count} sessions` : "");
    h = setTextTrait(h, "sessionDuration", data.session_duration_hrs ? `${data.session_duration_hrs} hrs each` : "");
    h = setTextTrait(h, "format", formatFormat(data.format));
    h = setTextTrait(h, "level", formatLevel(data.level));
    h = setTextTrait(h, "language", data.language || "English");
    parts.push(h);
  }

  // ── About ─────────────────────────────────────────────────────────────────
  {
    let h = templates.about;
    if (data.body) {
      h = h.replace(
        /(<div[^>]+\bdata-trait="descriptionLong"[^>]*>)\s*<p>[\s\S]*?<\/p>\s*(<div[^>]+\bdata-trait="descriptionLongExtra")/,
        `$1\n${data.body}\n$2`
      );
    }
    if (data.accessibility_notes) {
      h = setDivTrait(h, "accessibilityNotes", esc(data.accessibility_notes));
    }
    parts.push(h);
  }

  // ── Facilitator ───────────────────────────────────────────────────────────
  {
    let h = templates.facilitator;
    h = setTextTrait(h, "fullName", data.facilitator_name || "");
    h = setTextTrait(h, "pronouns", data.facilitator_pronouns || "");
    h = setTextTrait(h, "bio", facilitatorBio);
    if (data.facilitator_photo) {
      h = setSrcTrait(h, "photoPath", data.facilitator_photo);
    }
    parts.push(h);
  }

  // ── Schedule (optional, generated from data) ──────────────────────────────
  if (sessions.length > 0 || optional["eac-ws-schedule"] === true) {
    parts.push(buildScheduleHtml(sessions));
  }

  // ── Gallery (optional, generated from data) ───────────────────────────────
  const hasGallery = (data.gallery_image_urls?.length ?? 0) > 0 || Boolean(data.promo_video_url);
  if (hasGallery || optional["eac-ws-gallery"] === true) {
    parts.push(buildGalleryHtml(data.gallery_image_urls ?? [], data.promo_video_url));
  }

  // ── Testimonials — future table, skip unless explicitly enabled ───────────
  // (intentionally omitted)

  // ── Related — skip unless explicitly enabled ──────────────────────────────
  // (intentionally omitted)

  // ── Register ──────────────────────────────────────────────────────────────
  {
    let h = templates.register;
    h = setTextTrait(h, "priceFull", priceFull);
    h = setTextTrait(h, "priceContext", priceContext);
    if (data.sliding_scale_note) {
      h = setTextTrait(h, "slidingScaleNote", data.sliding_scale_note);
      h = h.replace(/(<p[^>]+\bdata-trait="slidingScaleNote"[^>]*)\s+hidden/, "$1");
    }
    h = setTextTrait(h, "spotsRemaining", data.attendee_limit ? `${data.attendee_limit} spots remaining` : "");
    h = setTextTrait(h, "startsIn", startsIn(data.scheduled_at));
    h = setTextTrait(h, "ctaLabel", ctaText);
    h = setHrefTrait(h, "registrationUrl", regUrl);
    h = setTextTrait(h, "deadlineNote", regDeadline);
    parts.push(h);
  }

  return parts.join("\n");
}

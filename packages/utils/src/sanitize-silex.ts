/**
 * HTML sanitization for Silex-published org sites.
 *
 * Published HTML is authored by org owners in the Silex/GrapeJS editor and
 * rendered into the public site with `dangerouslySetInnerHTML`, so it must be
 * sanitized both at publish-ingestion time and at render time. Unlike
 * `sanitizeRichText` (TipTap subset), full-page designs need a much broader
 * surface: arbitrary layout markup, inline SVG, `<style>` blocks, and
 * stylesheet `<link>`s — but never executable script.
 *
 * What is removed:
 *   - <script> and inline event handlers (on*) — DOMPurify default
 *   - javascript:/data:text URLs
 *   - iframes outside the YouTube/Vimeo allowlist (shared hook in sanitize.ts)
 *   - <link> elements that are not rel="stylesheet" with a safe href
 *   - <meta>, <base>, and form-hijacking attributes
 *
 * What is preserved:
 *   - All structural/layout HTML + class/style/id attributes
 *   - Inline SVG (sanitized via DOMPurify's SVG profile)
 *   - <style> blocks and rel="stylesheet" <link>s (relative or https href)
 *   - <eac-embed> custom elements and data-* attributes, which the
 *     silex-render pipeline replaces with live React embeds after sanitization
 */

import DOMPurify from 'isomorphic-dompurify';

let hooksRegistered = false;

function registerSilexHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    // Only allow stylesheet links with safe (relative or http(s)) hrefs.
    if (data.tagName === 'link') {
      const el = node as Element;
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      const href = el.getAttribute('href') || '';
      const safeHref =
        href.startsWith('/') ||
        href.startsWith('./') ||
        href.startsWith('https://') ||
        href.startsWith('http://');
      if (rel !== 'stylesheet' || !safeHref) {
        el.parentNode?.removeChild(el);
      }
    }
  });
}

/** Tags beyond DOMPurify's html+svg profiles that Silex pages rely on. */
const ADD_TAGS = [
  'eac-embed', // live-embed placeholder consumed by silex-render
  'link', // stylesheet links (locked to rel="stylesheet" by hook above)
  'style', // GrapeJS inline style blocks
  'main',
  'picture',
  'source',
  'video',
  'audio',
  'track',
];

const ADD_ATTR = [
  'target',
  'rel',
  'media',
  'sizes',
  'srcset',
  'poster',
  'controls',
  'autoplay',
  'muted',
  'loop',
  'playsinline',
  'preload',
  'loading',
  'role',
  'aria-label',
  'aria-hidden',
  'aria-labelledby',
  'aria-describedby',
  // Form controls (templates use inquiry/commission forms; action is stripped
  // below so they can only submit to the current page, never a foreign origin)
  'type',
  'name',
  'value',
  'placeholder',
  'required',
  'rows',
  'for',
  'disabled',
  'checked',
  'selected',
  'min',
  'max',
  'step',
  'maxlength',
  'autocomplete',
];

/**
 * Sanitize a Silex-published HTML page (full page or fragment) into markup
 * safe to render with `dangerouslySetInnerHTML`. Idempotent — safe to apply
 * at publish time and again at render time.
 */
export function sanitizeSilexHtml(html: string | null | undefined): string {
  if (!html) return '';
  registerSilexHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    // Keep leading <link>/<style> in the fragment instead of hoisting them
    // into a dropped <head> (published pages start with their CSS link).
    FORCE_BODY: true,
    ADD_TAGS,
    ADD_ATTR,
    ALLOW_DATA_ATTR: true,
    // Keep <eac-embed> from being stripped as an unknown custom element.
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^eac-/,
      attributeNameCheck: /^[\w-]+$/,
      allowCustomizedBuiltInElements: false,
    },
    FORBID_TAGS: ['script', 'meta', 'base', 'object', 'embed', 'applet'],
    FORBID_ATTR: ['formaction', 'action'],
  });
}

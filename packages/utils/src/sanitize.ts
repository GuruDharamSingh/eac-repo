/**
 * HTML sanitization for rich-text content authored in the TipTap editors.
 *
 * Content is stored as raw HTML, but it originates from user input (including
 * anonymous reflections), so it MUST be sanitized before being rendered with
 * `dangerouslySetInnerHTML`. This module is isomorphic — safe to call on the
 * server (API write paths, RSC) and in the browser.
 *
 * The allowlist is intentionally broad: it covers every mark/node the richest
 * TipTap toolbar in the app can emit (StarterKit + Link, Underline, TextAlign,
 * Color/TextStyle, FontSize, Highlight, Image, CodeBlockLowlight, Table, and
 * YouTube embeds). Leaner editors emit a subset, so a single allowlist serves
 * all of them.
 */

import DOMPurify from 'isomorphic-dompurify';

/** Tags emitted by the full set of TipTap extensions used across the apps. */
const ALLOWED_TAGS = [
  // Block / structure
  'p', 'div', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote',
  'ul', 'ol', 'li',
  'pre', 'code',
  // Inline marks
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
  'a',
  // A defined term. Inert and semantic — the element HTML has for exactly
  // this — but it must be allowed or the dictionary is stripped on save,
  // before the wiki ever sees it.
  'dfn', 'abbr',
  // Media
  'img',
  'iframe', // YouTube embeds (src is locked down below)
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
];

const ALLOWED_ATTR = [
  // Links
  'href', 'target', 'rel',
  // Images
  'src', 'alt', 'title', 'width', 'height',
  // Inline styling (color, font-size, text-align, highlight background)
  'style',
  // Code highlighting / alignment classes from lowlight + TipTap
  'class',
  'data-language',
  // Table layout
  'colspan', 'rowspan', 'data-colwidth',
  // Wiki link targets and defined terms. These carry a TARGET, never an href
  // or a script, so they are inert — but they must survive sanitising or the
  // feature quietly dies at the save boundary. data-wiki-slug especially:
  // stored bodies hold resolved anchors, so stripping it here would make a
  // re-save look like a body with no links and drop the page's backlinks.
  'data-wiki-slug', 'data-wiki-new',
  'data-term', 'data-definition', 'data-senses', 'data-href',
  // YouTube iframe attributes
  'allow', 'allowfullscreen', 'frameborder',
];

/**
 * Only YouTube/Vimeo embed sources are permitted for iframes. Everything else
 * is stripped to avoid arbitrary-origin framing.
 */
const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
];

let hooksRegistered = false;

function registerHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  // Lock down iframe sources to known embed providers.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;
    const el = node as Element;
    const src = el.getAttribute('src') || '';
    let host = '';
    try {
      host = new URL(src, 'https://localhost').hostname;
    } catch {
      host = '';
    }
    if (!ALLOWED_IFRAME_HOSTS.includes(host)) {
      el.parentNode?.removeChild(el);
    }
  });

  // Harden links: force safe rel and open external links in a new tab.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      if (node.getAttribute('target') === '_blank') {
        node.setAttribute('target', '_blank');
      }
    }
  });
}

/**
 * Sanitize a rich-text HTML string into a safe subset for rendering.
 * Returns an empty string for nullish/empty input.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  registerHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Allow the data-* attributes TipTap/lowlight rely on.
    ADD_ATTR: ['target'],
    ALLOW_DATA_ATTR: true,
    // Never allow inline event handlers or javascript: URLs (DOMPurify default).
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}

/**
 * Sanitize a compiled post body: the rich-text subset above, plus the
 * <eac-embed> markers that renderSilexHtmlWithEmbeds swaps for live
 * components.
 *
 * Why a third profile rather than reusing one of the existing two:
 *
 *   sanitizeRichText   strips <eac-embed> as an unknown element, so every
 *                      component in a post would silently vanish.
 *   sanitizeSilexHtml  keeps embeds but opens the allowlist up to full-page
 *                      design markup (layout containers, positioning, fonts).
 *                      That breadth is right for a Silex-published site and
 *                      much too wide for a blog post.
 *
 * A marker carries no content of its own — the renderer replaces the whole
 * element — so only the attributes that select and configure a component need
 * to survive. Everything inside a marker is discarded downstream anyway.
 */
export function sanitizePostBody(html: string | null | undefined): string {
  if (!html) return '';
  registerHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS, 'eac-embed'],
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
    ALLOW_DATA_ATTR: true,
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    // <eac-embed> is a custom element; without this DOMPurify drops it
    // regardless of the allowlist.
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^eac-embed$/,
      attributeNameCheck: /^data-[a-z-]+$/,
      allowCustomizedBuiltInElements: false,
    },
  });
}

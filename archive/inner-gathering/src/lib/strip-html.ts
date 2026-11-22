/**
 * Strip HTML tags from a string to get plain text.
 * Used for preview/card displays where we want a text summary
 * of rich text content.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')   // Replace tags with spaces
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
}

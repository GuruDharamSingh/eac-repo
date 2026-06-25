// ============================================================================
// Substack RSS reader. Shared by /api/substack-feed (client widgets) and the
// feed page server component (Publications tab cards). Hand-rolled parser —
// the feed is small and we avoid pulling an XML dependency.
// ============================================================================

const FEED_URL = "https://elkdonisarts.substack.com/feed";

export interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

function extractText(xml: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const cdataOpen = `<${tag}><![CDATA[`;
  const cdataClose = `]]></${tag}>`;

  const cdataStart = xml.indexOf(cdataOpen);
  if (cdataStart !== -1) {
    const contentStart = cdataStart + cdataOpen.length;
    const contentEnd = xml.indexOf(cdataClose, contentStart);
    if (contentEnd !== -1) return xml.slice(contentStart, contentEnd).trim();
  }

  const start = xml.indexOf(open);
  if (start === -1) return "";
  const contentStart = start + open.length;
  const contentEnd = xml.indexOf(close, contentStart);
  if (contentEnd === -1) return "";
  return xml.slice(contentStart, contentEnd).trim();
}

function parseItems(xml: string): SubstackPost[] {
  const items: SubstackPost[] = [];
  let cursor = 0;
  while (true) {
    const itemStart = xml.indexOf("<item>", cursor);
    if (itemStart === -1) break;
    const itemEnd = xml.indexOf("</item>", itemStart);
    if (itemEnd === -1) break;
    const chunk = xml.slice(itemStart + 6, itemEnd);
    cursor = itemEnd + 7;

    const title = extractText(chunk, "title");
    const link = extractText(chunk, "link");
    const pubDate = extractText(chunk, "pubDate");
    const description = extractText(chunk, "description");

    if (title && link) {
      const plainDesc = description.replace(/<[^>]*>/g, "").slice(0, 160);
      items.push({ title, link, pubDate, description: plainDesc });
    }
  }
  return items;
}

/** Fetch + parse the latest Substack posts. Returns [] on any failure. */
export async function fetchSubstackPosts(limit = 10): Promise<SubstackPost[]> {
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate: 3600 }, // cache 1h
      headers: { "User-Agent": "EAC-Site/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml).slice(0, limit);
  } catch {
    return [];
  }
}

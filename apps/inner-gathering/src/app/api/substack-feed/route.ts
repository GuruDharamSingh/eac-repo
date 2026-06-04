import { NextResponse } from "next/server";

const FEED_URL = "https://elkdonisarts.substack.com/feed";

interface SubstackPost {
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

  // Try CDATA first
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
      // Strip any HTML tags from description for plain text preview
      const plainDesc = description.replace(/<[^>]*>/g, "").slice(0, 160);
      items.push({ title, link, pubDate, description: plainDesc });
    }
  }
  return items;
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate: 3600 }, // cache for 1 hour
      headers: { "User-Agent": "EAC-Site/1.0" },
    });
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const xml = await res.text();
    const posts = parseItems(xml).slice(0, 3);
    return NextResponse.json(posts, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

#!/usr/bin/env python3
"""Link rules for live-snapshot.sh. Reads an HTML file, prints one line per same-host link:

    ok<TAB>/path?query
    skip<TAB>/path?query<TAB>reason

`--one <href>` applies the same rules to a single href (a redirect's Location).
Only <a href> is followed: a crawl never loads what a page merely references, and it
never submits a form or presses a button because neither exists for it.
"""
import html.parser
import re
import sys
import urllib.parse

# Each rule is (reason, regex on the path). Order decides which reason is reported.
RULES = [
    ("next internals", r"^/_next(/|$)"),
    ("api path", r"(^|/)api(/|$)"),
    ("sign-in path", r"(^|/)(login|logout|signin|sign-in|signout|sign-out|signup|sign-up|register|auth|oauth|sso|handoff)(/|$)"),
    ("manage path", r"(^|/)(manage|hub|admin|studio|center|account|profile|settings|builder|compose)(/|$)"),
    # forum-ui ThreadPage runs UPDATE threads SET view_count on every GET
    # (packages/forum-ui/src/pages.tsx:656, packages/services/src/forum.ts:718), so it is a write.
    ("records a view on GET", r"(^|/)t/[^/]+"),
    ("acts on GET", r"(^|/)(checkout|cart|buy|pay|payouts|unsubscribe|subscribe|confirm|rsvp|coming|join|invite|accept|new|edit|delete|remove)(/|$)"),
    ("not a page", r"\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|m4a|mp3|wav|mov|webm|ics|xml|json|txt|css|js|map|woff2?|ttf|rss)$"),
]
RULES = [(r, re.compile(x, re.I)) for r, x in RULES]


def judge(href, host, base):
    """Returns (verdict, path, reason), or None when the href leaves the host."""
    href = (href or "").strip()
    if not href or href.startswith("#"):
        return None
    u = urllib.parse.urlsplit(urllib.parse.urljoin(base, href))
    if u.scheme not in ("http", "https"):
        return None
    if (u.hostname or "").lower() != host.lower():
        return None
    path = u.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    full = path + (("?" + u.query) if u.query else "")
    for reason, rx in RULES:
        if rx.search(path):
            return ("skip", full, reason)
    if re.search(r"(^|&)(_rsc|voters|logout|action)=", u.query):
        return ("skip", full, "query acts or is internal")
    return ("ok", full, "")


class Anchors(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for k, v in attrs:
                if k == "href":
                    self.hrefs.append(v)


def main():
    if sys.argv[1] == "--one":
        href, host, path = sys.argv[2], sys.argv[3], sys.argv[4]
        hrefs = [href]
    else:
        body, host, path = sys.argv[1], sys.argv[2], sys.argv[3]
        a = Anchors()
        with open(body, encoding="utf-8", errors="replace") as f:
            a.feed(f.read())
        hrefs = a.hrefs
    base = f"https://{host}{path}"
    seen = set()
    rows = []
    for h in hrefs:
        j = judge(h, host, base)
        if j and j[1] not in seen:
            seen.add(j[1])
            rows.append(j)
    # Sorted so a crawl's order does not depend on where a link sits in the markup.
    for verdict, full, reason in sorted(rows, key=lambda r: r[1]):
        print("\t".join(x for x in (verdict, full, reason) if x))


if __name__ == "__main__":
    main()

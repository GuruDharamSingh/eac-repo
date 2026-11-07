#!/usr/bin/env python3
"""Compare two snapshots taken by live-snapshot.sh.

    live-compare.py <before> <after> [--report FILE] [--diff-dir DIR] [--pixel-tol 8]
                    [--max-lines 24] [--keep-dates] [--no-pixels] [--browsers "chromium firefox"]

Reports, per page: status and header changes, markup differences after normalising what
changes on every request or every build, editor markers newly present, and a pixel
difference for each screenshot. Exit status: 0 no difference, 1 differences, 2 usage.

What the markup comparison ignores, and why, is the NORMALISE table below. Scripts are not
compared as markup: a rebuild renumbers everything in the flight payload. They are still
counted for the markers, so a marker in serialized props is reported.
"""
import argparse
import difflib
import json
import os
import re
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    np = None

# Marker text that must not reach a signed-out page. Counted case-insensitively in the raw
# HTML and in the static files the page names. "morph" is a plain substring, so an unrelated
# word can hold it; what is reported is the change in the count against the earlier snapshot.
MARKERS = ["data-tree-", "de-vpanel", "data-de-ui", "morph"]

MONTH = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
DAY = r"(?:Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:r(?:s(?:day)?)?)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)"

# (name, regex, replacement), applied to the markup with its scripts removed.
NORMALISE = [
    ("nonce", r'\snonce="[^"]*"', ""),
    ("deployment id", r'\sdata-dpl-id="[^"]*"', ""),
    ("static file names", r"/_next/static/[A-Za-z0-9._/~%-]+", "/_next/static/#"),
    ("build query", r"\?(?:dpl|v)=[A-Za-z0-9_-]{6,}", ""),
    ("react useId", r"_R_[A-Za-z0-9]+_|:[Rr][0-9a-zA-Z]+:|«[Rr][0-9a-zA-Z]+»", "#id"),
    ("css module hash", r"-module__[A-Za-z0-9_-]{6,}__", "-module__#__"),
    ("next/font class", r"__(className|variable)_[0-9a-f]{5,}", r"__\1_#"),
    ("turbopack font class", r"\b([a-z_0-9]+)_[0-9a-f]{6,}-module__", r"\1_#-module__"),
    ("streaming placeholder", r'<template id="[A-Z]+:[0-9a-f]+"></template>|<!--\$[?!]?-->|<!--/\$-->', ""),
    ("view counts", r"<b>[\d,.]+k?</b>(\s*<small>views?</small>)", r"<b>#</b>\1"),
    ("view counts in words", r"\b[\d,.]+k? views?\b", "# views"),
    # The "Add to calendar" link is a data: URL whose DTSTAMP is the time of the request.
    ("calendar stamp", r"DTSTAMP(%3A|:)\d{8}T\d{6}Z?", r"DTSTAMP\1#"),
]
DATES = [
    ("iso time", r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?", "#time"),
    ("iso day", r"\b\d{4}-\d{2}-\d{2}\b", "#day"),
    ("long date", rf"\b(?:{DAY},?\s+)?{MONTH}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?(?:,?\s+(?:at\s+)?\d{{1,2}}(?::\d{{2}})?\s*[AaPp]\.?[Mm]\.?)?", "#date"),
    ("day first date", rf"\b(?:{DAY},?\s+)?\d{{1,2}}\s+{MONTH}\.?(?:\s+\d{{4}})?", "#date"),
    ("clock time", r"\b\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?(?:\s*[A-Z]{2,4})?", "#clock"),
    ("relative", r"\b(?:in\s+)?\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?|mo|mos|months?|y|yr|yrs|years?)\b(?:\s+(?:ago|left|away|from now))?", "#ago"),
    ("relative words", r"\b(?:just now|yesterday|today|tomorrow)\b", "#ago"),
    ("next-weekday", rf"\b(?:this|next|last)\s+{DAY}\b", "#ago"),
]
NORMALISE_RX = [(n, re.compile(x), r) for n, x, r in NORMALISE]
DATES_RX = [(n, re.compile(x, re.I), r) for n, x, r in DATES]

TEXT_RX = re.compile(r"(>)([^<]+)(<)")
WORD_ATTR_RX = re.compile(r"(\b(?:datetime|title|aria-label|alt)=\")([^\"]*)(\")")
SCRIPT_RX = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
STATIC_LINK_RX = re.compile(r"<link\b[^>]*\bhref=\"/_next/static/[^\"]*\"[^>]*/?>", re.I)
ASSET_RX = re.compile(r"/_next/static/[A-Za-z0-9._/~%-]+\.(?:js|css)")
# Headers that move with a build or are per-response.
HEADER_SKIP = re.compile(r"^(?:x-nextjs-cache|x-nextjs-prerender|date|age|etag)\s*:", re.I)


def read_manifest(d):
    rows = {}
    with open(d / "manifest.tsv", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 4:
                rows[parts[2]] = {"key": parts[1], "status": parts[3], "n": int(parts[0])}
    return rows


def read_assets(d):
    rows = {}
    p = d / "assets.tsv"
    if not p.exists():
        return rows
    with open(p, encoding="utf-8") as f:
        head = f.readline().rstrip("\n").split("\t")
        for line in f:
            v = line.rstrip("\n").split("\t")
            if len(v) == len(head):
                rows[v[0]] = dict(zip(head, v))
    return rows


def split_scripts(html):
    """(markup without scripts, script text). JSON-LD stays in the markup: it is content."""
    scripts = []

    def drop(m):
        if "ld+json" in m.group(1):
            return m.group(0)
        scripts.append(m.group(0))
        return ""
    return SCRIPT_RX.sub(drop, html), "\n".join(scripts)


def normalise(markup, keep_dates):
    s = STATIC_LINK_RX.sub("", markup)
    for _, rx, rep in NORMALISE_RX:
        s = rx.sub(rep, s)
    if not keep_dates:
        # Text and the attributes that hold words only: in a URL "%0D" reads as "0 days".
        def dated(m):
            t = m.group(2)
            for _, rx, rep in DATES_RX:
                t = rx.sub(rep, t)
            return m.group(1) + t + m.group(3)
        s = TEXT_RX.sub(dated, s)
        s = WORD_ATTR_RX.sub(dated, s)
    s = re.sub(r"\s+", " ", s)
    return [x for x in re.sub(r">\s*<", ">\n<", s).split("\n") if x.strip()]


def count_markers(text):
    low = text.lower()
    return {m: low.count(m) for m in MARKERS}


def page_assets(html, assets):
    names = set(ASSET_RX.findall(html))
    out = {"js": 0, "css": 0, "files": 0, "unknown": 0, "markers": {m: 0 for m in MARKERS}}
    for n in names:
        a = assets.get(n)
        if not a:
            out["unknown"] += 1
            continue
        out["files"] += 1
        out["js" if n.endswith(".js") else "css"] += int(a["bytes"])
        for m in MARKERS:
            out["markers"][m] += int(a.get(m, 0) or 0)
    return out


def pixel_diff(a_path, b_path, tol, diff_path):
    """None when the files are the same or within tolerance, else a description."""
    if a_path.read_bytes() == b_path.read_bytes():
        return None
    if np is None:
        return {"note": "files differ; numpy and Pillow are not available to measure it"}
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    w, h = min(a.width, b.width), min(a.height, b.height)
    x = np.asarray(a.crop((0, 0, w, h)), dtype=np.int16)
    y = np.asarray(b.crop((0, 0, w, h)), dtype=np.int16)
    mask = np.abs(x - y).max(axis=2) > tol
    changed = int(mask.sum())
    area = max(a.width * a.height, b.width * b.height)
    extra = area - w * h
    if changed == 0 and a.size == b.size:
        return None
    out = {"pct": round(100.0 * (changed + extra) / area, 3), "pixels": changed + extra, "before": list(a.size), "after": list(b.size)}
    if changed:
        ys, xs = np.where(mask)
        out["bbox"] = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
    if diff_path is not None:
        diff_path.parent.mkdir(parents=True, exist_ok=True)
        canvas = np.full((max(a.height, b.height), max(a.width, b.width), 3), 255, dtype=np.uint8)
        canvas[:h, :w] = (x * 0.25 + 191).clip(0, 255).astype(np.uint8)
        canvas[:h, :w][mask] = [220, 30, 30]
        Image.fromarray(canvas).save(diff_path)
        out["image"] = str(diff_path)
    return out


def load_json(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def sidecar_changes(a, b):
    """What a page did in the browser: only what is new in the later run."""
    out = []
    a = a or {}
    b = b or {}
    for field, label in (("console", "console error"), ("pageErrors", "page error"), ("failed", "failed request")):
        new = sorted(set(b.get(field) or []) - set(a.get(field) or []))
        gone = sorted(set(a.get(field) or []) - set(b.get(field) or []))
        out += [f"new {label}: {x}" for x in new[:6]]
        out += [f"{label} no longer seen: {x}" for x in gone[:3]]
    ra = (a.get("refused") or {}).get("nonGet") or []
    rb = (b.get("refused") or {}).get("nonGet") or []
    for x in sorted(set(rb) - set(ra)):
        out.append(f"new non-GET attempted (refused): {x}")
    for x in sorted(set((b.get("refused") or {}).get("otherHost") or []) - set((a.get("refused") or {}).get("otherHost") or [])):
        out.append(f"new other host asked for (refused): {x}")
    if b.get("error") and not a.get("error"):
        out.append(f"new load error: {b['error']}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("before", type=Path)
    ap.add_argument("after", type=Path)
    ap.add_argument("--report", type=Path)
    ap.add_argument("--diff-dir", type=Path)
    ap.add_argument("--pixel-tol", type=int, default=8)
    ap.add_argument("--max-lines", type=int, default=24)
    ap.add_argument("--keep-dates", action="store_true")
    ap.add_argument("--no-pixels", action="store_true")
    ap.add_argument("--browsers", help="space-separated; default every browser in either snapshot")
    o = ap.parse_args()
    for d in (o.before, o.after):
        if not (d / "manifest.tsv").exists():
            print(f"not a snapshot: {d}", file=sys.stderr)
            return 2

    ma, mb = read_manifest(o.before), read_manifest(o.after)
    aa, ab = read_assets(o.before), read_assets(o.after)
    lines = []
    say = lines.append
    tally = {"status": 0, "headers": 0, "markup": 0, "markers": 0, "assets": 0, "asset markers": 0, "browser": 0, "pixels": 0, "pixel checks": 0, "gone": 0, "new": 0}

    gone = sorted(set(ma) - set(mb), key=lambda p: ma[p]["n"])
    new = sorted(set(mb) - set(ma), key=lambda p: mb[p]["n"])
    tally["gone"], tally["new"] = len(gone), len(new)
    page_lines = []

    browsers = sorted({p.name for d in (o.before, o.after) if (d / "shots").is_dir() for p in (d / "shots").iterdir() if p.is_dir()})
    if o.browsers:
        browsers = [b for b in browsers if b in o.browsers.split()]
    for path in sorted(set(ma) & set(mb), key=lambda p: ma[p]["n"]):
        ka, kb = ma[path]["key"], mb[path]["key"]
        pa, pb = o.before / "pages" / ka, o.after / "pages" / kb
        notes = []
        if ma[path]["status"] != mb[path]["status"]:
            tally["status"] += 1
            notes.append(f"status {ma[path]['status']} -> {mb[path]['status']}")

        ha = [x for x in (pa / "headers.txt").read_text(errors="replace").splitlines() if not HEADER_SKIP.match(x)] if (pa / "headers.txt").exists() else []
        hb = [x for x in (pb / "headers.txt").read_text(errors="replace").splitlines() if not HEADER_SKIP.match(x)] if (pb / "headers.txt").exists() else []
        if ha != hb:
            tally["headers"] += 1
            notes += [f"header {x}" for x in difflib.ndiff(ha, hb) if x[:2] in ("- ", "+ ")]

        ba = (pa / "body.html").read_text(encoding="utf-8", errors="replace") if (pa / "body.html").exists() else ""
        bb = (pb / "body.html").read_text(encoding="utf-8", errors="replace") if (pb / "body.html").exists() else ""
        ca, cb = count_markers(ba), count_markers(bb)
        for m in MARKERS:
            if cb[m] > ca[m]:
                tally["markers"] += 1
                notes.append(f"EDITOR MARKER newly present in the HTML: {m} {ca[m]} -> {cb[m]}")
            elif cb[m] < ca[m]:
                notes.append(f"marker count fell: {m} {ca[m]} -> {cb[m]}")

        da, sa = split_scripts(ba)
        db, sb = split_scripts(bb)
        na, nb = normalise(da, o.keep_dates), normalise(db, o.keep_dates)
        if na != nb:
            tally["markup"] += 1
            diff = [x for x in difflib.unified_diff(na, nb, lineterm="", n=0) if not x.startswith(("---", "+++", "@@"))]
            plus = sum(1 for x in diff if x.startswith("+"))
            minus = sum(1 for x in diff if x.startswith("-"))
            notes.append(f"markup differs: +{plus} -{minus} lines after normalising")
            notes += ["  " + x[:220] for x in diff[: o.max_lines]]
            if len(diff) > o.max_lines:
                notes.append(f"  ... {len(diff) - o.max_lines} more lines")

        wa, wb = page_assets(ba, aa), page_assets(bb, ab)
        for m in MARKERS:
            if wb["markers"][m] > wa["markers"][m]:
                tally["asset markers"] += 1
                notes.append(f"EDITOR MARKER newly present in this page's static files: {m} {wa['markers'][m]} -> {wb['markers'][m]}")
        if (wa["js"], wa["css"]) != (wb["js"], wb["css"]):
            tally["assets"] += 1
            notes.append(f"static files named by the page: js {wa['js']} -> {wb['js']} bytes ({wb['js'] - wa['js']:+d}), css {wa['css']} -> {wb['css']} bytes ({wb['css'] - wa['css']:+d})")

        for b in browsers:
            base_a, base_b = o.before / "shots" / b, o.after / "shots" / b
            widths = sorted({x.name for base in (base_a, base_b) if base.is_dir() for x in base.iterdir() if x.is_dir()}, key=int)
            for w in widths:
                ia, ib = base_a / w / f"{ka}.png", base_b / w / f"{kb}.png"
                ja, jb = load_json(base_a / w / f"{ka}.json"), load_json(base_b / w / f"{kb}.json")
                # A record missing on one side is reported below as a missing screenshot, not as changes.
                for c in sidecar_changes(ja, jb) if ja and jb else []:
                    tally["browser"] += 1
                    notes.append(f"{b} {w}: {c}")
                if ja and jb and (jb.get("scrollWidth") or 0) > int(w) >= (ja.get("scrollWidth") or 0):
                    tally["browser"] += 1
                    notes.append(f"{b} {w}: sideways overflow is new: page {jb['scrollWidth']} px wide")
                if o.no_pixels:
                    continue
                if ia.exists() != ib.exists():
                    tally["pixels"] += 1
                    notes.append(f"{b} {w}: screenshot only in {'before' if ia.exists() else 'after'}")
                    continue
                if not ia.exists():
                    continue
                tally["pixel checks"] += 1
                d = pixel_diff(ia, ib, o.pixel_tol, (o.diff_dir / b / w / f"{ka}.png") if o.diff_dir else None)
                if d:
                    tally["pixels"] += 1
                    if "note" in d:
                        notes.append(f"{b} {w}: {d['note']}")
                    else:
                        size = f", size {d['before'][0]}x{d['before'][1]} -> {d['after'][0]}x{d['after'][1]}" if d["before"] != d["after"] else ""
                        where = f", box x={d['bbox'][0]} y={d['bbox'][1]} {d['bbox'][2]}x{d['bbox'][3]}" if "bbox" in d else ""
                        pic = f", picture {d['image']}" if "image" in d else ""
                        notes.append(f"{b} {w}: pixels differ {d['pct']}% ({d['pixels']} px){size}{where}{pic}")
        if notes:
            page_lines.append(f"== {path}")
            page_lines += ["   " + n for n in notes]

    total = sum(v for k, v in tally.items() if k != "pixel checks")
    say(f"before: {o.before}")
    say(f"after:  {o.after}")
    say(f"pages:  before {len(ma)}, after {len(mb)}, gone {len(gone)}, new {len(new)}")
    say("status changes        {status}".format(**tally))
    say("header changes        {headers}".format(**tally))
    say("markup differences    {markup}".format(**tally))
    say("editor markers, HTML  {markers}".format(**tally))
    say("editor markers, files {0}".format(tally["asset markers"]))
    say("static weight changes {assets}".format(**tally))
    say("browser-side changes  {browser}".format(**tally))
    say(f"screenshots differing {tally['pixels']} of {tally['pixel checks']} compared (tolerance {o.pixel_tol} per channel)" + ("; pixels not compared" if o.no_pixels else ""))
    say("RESULT: " + ("no difference" if total == 0 else f"{total} differences"))
    for p in gone:
        say(f"== {p}\n   page gone (was {ma[p]['status']})")
    for p in new:
        say(f"== {p}\n   page new ({mb[p]['status']})")
    lines += page_lines
    text = "\n".join(lines) + "\n"
    sys.stdout.write(text)
    if o.report:
        o.report.parent.mkdir(parents=True, exist_ok=True)
        o.report.write_text(text, encoding="utf-8")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

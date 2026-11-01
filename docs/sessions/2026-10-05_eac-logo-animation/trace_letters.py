"""Trace the EAC letterforms from the 940px colored logo into smooth vector paths.

Output (in /w): letters.json  {viewBox, letters:[{id, d}]}, letters-preview.png
Coordinates are in the original logo's pixel space, offset to the crop origin.
"""
import json
import colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
import potrace

SRC = '/w/eac-color.jpg'
CROP = (250, 270, 670, 500)      # x0, y0, x1, y1 in the 940x957 original
SCALE = 6                         # supersample before thresholding

im = Image.open(SRC).convert('RGB').crop(CROP)
W0, H0 = im.size
big = im.resize((W0 * SCALE, H0 * SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(SCALE * 0.7))
a = np.asarray(big).astype(np.float32) / 255.0

mx = a.max(axis=2)
mn = a.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
mask = (mx > 0.30) & (sat > 0.28)

# hue classes (degrees): blue ~215, gold ~40, red ~0/355
r, g, b = a[..., 0], a[..., 1], a[..., 2]
hue = np.zeros_like(mx)
d = np.maximum(mx - mn, 1e-6)
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
cls = np.full(mx.shape, -1)
cls[mask & (hue > 170) & (hue < 280)] = 0           # blue  -> E
cls[mask & (hue >= 22) & (hue <= 62)] = 1           # gold  -> A
cls[mask & ((hue < 14) | (hue > 340))] = 2          # red   -> C

letters = []
names = ['E', 'A', 'C']
preview = Image.new('RGB', big.size, (0, 0, 0))
cols = [(90, 130, 210), (215, 165, 60), (205, 70, 60)]


def flatten(curve, n=14):
    pts = []
    p0 = curve.start_point
    pts.append((p0.x, p0.y))
    for s in curve.segments:
        if s.is_corner:
            pts.append((s.c.x, s.c.y))
            pts.append((s.end_point.x, s.end_point.y))
        else:
            c1, c2, e = s.c1, s.c2, s.end_point
            for i in range(1, n + 1):
                t = i / n
                x = (1-t)**3*p0.x + 3*(1-t)**2*t*c1.x + 3*(1-t)*t**2*c2.x + t**3*e.x
                y = (1-t)**3*p0.y + 3*(1-t)**2*t*c1.y + 3*(1-t)*t**2*c2.y + t**3*e.y
                pts.append((x, y))
        p0 = s.end_point
    return pts


def to_d(plist, k):
    # path data in original-pixel coordinates (divide supersample scale)
    out = []
    f = lambda p: f'{p.x / SCALE:.2f},{p.y / SCALE:.2f}'
    for curve in plist:
        out.append('M' + f(curve.start_point))
        for s in curve.segments:
            if s.is_corner:
                out.append('L' + f(s.c) + 'L' + f(s.end_point))
            else:
                out.append('C' + f(s.c1) + ' ' + f(s.c2) + ' ' + f(s.end_point))
        out.append('Z')
    return ''.join(out)


for k, name in enumerate(names):
    m = cls == k
    # close pin-holes and drop specks / ring fragments touching the crop edge
    m = ndi.binary_closing(m, iterations=SCALE)
    m = ndi.binary_fill_holes(m) | m if False else m   # keep counters (letter holes) intact
    lab, n = ndi.label(m)
    keep = np.zeros_like(m)
    for i in range(1, n + 1):
        comp = lab == i
        area = comp.sum()
        ys, xs = np.where(comp)
        touches = xs.min() < 3 or ys.min() < 3 or xs.max() > m.shape[1] - 4 or ys.max() > m.shape[0] - 4
        if area > (SCALE * SCALE) * 400 and not touches:
            keep |= comp
    best = None
    for inv in (False, True):
        bm = potrace.Bitmap(~keep if inv else keep)
        plist = bm.trace(turdsize=SCALE * SCALE * 8, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                         alphamax=1.1, opticurve=True, opttolerance=0.6)
        ras = Image.new('1', big.size, 0)
        rm = np.zeros(big.size[::-1], dtype=bool)
        for curve in plist:
            layer = Image.new('1', big.size, 0)
            ImageDraw.Draw(layer).polygon(flatten(curve), fill=1)
            rm ^= np.asarray(layer, dtype=bool)          # even-odd: holes cancel
        iou = (rm & keep).sum() / max((rm | keep).sum(), 1)
        if best is None or iou > best[0]:
            best = (iou, plist, rm, inv)
    iou, plist, rm, inv = best
    print(name, 'iou %.3f' % iou, 'inverted' if inv else 'direct')
    letters.append({'id': name, 'd': to_d(plist, k), 'area': int(keep.sum() / (SCALE * SCALE)), 'iou': round(float(iou), 3)})
    pa = np.asarray(preview).copy()
    pa[rm] = cols[k]
    preview = Image.fromarray(pa)

with open('/w/letters.json', 'w') as f:
    json.dump({'viewBox': [0, 0, W0, H0], 'source': 'eac-color.jpg crop %s' % (CROP,), 'letters': letters}, f)

# side by side: original (upscaled) | trace
orig = im.resize(big.size, Image.LANCZOS)
sheet = Image.new('RGB', (big.width * 2 + 10, big.height), (30, 30, 30))
sheet.paste(orig, (0, 0)); sheet.paste(preview, (big.width + 10, 0))
sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save('/w/letters-preview.png')
print({l['id']: l['area'] for l in letters}, W0, H0)

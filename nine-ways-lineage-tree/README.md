# Merit Field lineage tree (working copy)

Interactive page over the Menri Merit Field thangka. Open `index.html` through any static server
(`python3 -m http.server` in this folder); it is self-contained apart from `images/`.
Written 2026-10-04. Private working copy: the text and images come from ten "Field of Accumulation" posts on
ravencypresswood.com (Nine Ways, Raven Cypress Wood, all rights reserved); permission to republish is not confirmed.

## State (2026-10-04)
- 381 entries from ten posts, each placed on the thangka. **Verified** in headless Chrome: page loads without script
  errors, region click/hover, entry selection, search, dot dragging with persistence, 420 px layout.
- Placement precision, stored per entry as `prec`:
  - `exact` (101): on one figure, from the numbered diagrams (khandro 31, yidams 43, Gathering of Buddhas 13, large
    central figures and column tips). Checked visually against the painting for khandro and the central figures; the
    yidam and Buddha positions were not checked figure by figure.
  - `approx` (274): spread along a column or crescent in list order. The painted figure for each name is not identified.
  - `region` (6): a whole crescent or group.
- Registration: a thin-plate-spline warp from the master diagram (1166x1556) to the thangka (1580x1976) using 39
  hand-read landmarks (`build/warp.py`). Overlay checked by eye; column regions follow the painted columns, lower
  regions were checked in the khandro and left-hand yidam areas only.
- Open: the Zhang Zhung post numbers its lineage 1-101 but lists 102 names; the arrangement of figures inside the
  four-stripe centre column is unknown, so those dots are only proportional along the column. The abbots 5-34 are
  placed along the outer crescent with 24 fixed at its centre (from the diagram).

## Correcting positions
Use "Adjust positions" in the page, drag dots, "Export positions" writes `lineage-positions.json`
(`{"<section>:<n>": [x, y]}` in thangka pixels). Merge into `build/build.py` or the data when settled.

## Rebuild
    python3 build/parse.py sources        # sources/*/post.json -> data/lineage_raw.json
    python3 build/regions.py              # section masks -> images/regions/*.png, data/regions.json
    python3 build/build.py                # curated data + positions -> data/lineage.json, index.html
Needs Python 3 with numpy and Pillow only.

## Files
`lineage-tree.md` combined text of the ten posts; `images/` thangka, master diagram, per-section diagrams and
portraits; `images/regions/` highlight overlays; `data/` intermediate and final JSON; `build/` scripts and template.

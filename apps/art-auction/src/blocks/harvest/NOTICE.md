# Third-party notice: HyperUI

Written 2026-10-04. The blocks in this directory adapt markup from HyperUI.

- Project: HyperUI, https://github.com/markmead/hyperui (site: https://hyperui.dev)
- Licence: MIT (LICENSE fetched from the repository's `main` branch on 2026-10-04)
- Copyright line, as it appears in the LICENSE file: `Copyright (c) Mark Mead`

## Blocks and their sources

Paths are relative to the repository root; each file is a standalone HTML example.

| Block id | File | HyperUI source |
|---|---|---|
| `ha-stat-band` | `stat-band.tsx` | `public/examples/marketing/stats/1.html` |
| `ha-timeline` | `timeline.tsx` | `public/examples/application/timelines/1.html` |
| `ha-card-image` | `card-image.tsx` | `public/examples/marketing/cards/3.html` |
| `ha-card-ticket` | `card-ticket.tsx` | `public/examples/marketing/pricing/1.html` (card shape, price line, button); the dashed tear line and stub are new |
| `ha-announcement` | `announcement.tsx` | `public/examples/marketing/announcements/1.html` |
| `ha-feature-list` | `feature-list.tsx` | `public/examples/marketing/pricing/1.html` (check-mark list rows) and `public/examples/marketing/feature-grids/1.html` (heading block and spacing) |

Changes common to all: colour utilities replaced with this app's shadcn tokens,
copy turned into props, remote image URLs removed, `m-0` / `list-none` / `p-0`
added where the browser's defaults would otherwise apply. Each block file lists
its own changes in its header comment.

## MIT License

MIT License

Copyright (c) Mark Mead

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

// Title card: the frame dimmed, a title and subtitle in the middle.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .tc { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; padding: 0 160px;
    background: rgba(12, 10, 9, var(--dim, 0.85)); text-shadow: 0 2px 18px rgba(0, 0, 0, 0.45);
    opacity: 0; transform: scale(1.02); transition: opacity 450ms var(--ease), transform 600ms var(--ease); }
  .in .tc { opacity: 1; transform: none; }
  .title { font-family: var(--serif); font-size: 112px; line-height: 1.08; font-weight: 500; }
  .rule { width: 120px; height: 6px; background: var(--accent); margin: 34px auto; }
  .sub { font-size: 40px; color: var(--muted); }
  .sub:empty { display: none; }
`;

export default class TitleCard extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="tc"><div class="title"></div><div class="rule"></div><div class="sub"></div></div>'; }
  render(d) {
    this.text('.title', d.title);
    this.text('.sub', d.subtitle);
    const dim = Number(d.dim);
    this.$('.tc').style.setProperty('--dim', String(Number.isFinite(dim) ? Math.min(1, Math.max(0, dim)) : 0.85));
  }
}

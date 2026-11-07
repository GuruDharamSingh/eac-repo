// Quote: the frame dimmed, a quotation in large italic type, and who said it.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .q { position: absolute; inset: 0; display: grid; place-content: center; padding: 0 180px;
    background: rgba(12, 10, 9, var(--dim, 0.72)); opacity: 0; transition: opacity 500ms var(--ease); }
  .in .q { opacity: 1; }
  .inner { max-width: 1500px; transform: translateY(20px); transition: transform 700ms var(--ease); }
  .in .inner { transform: none; }
  .mark { font-family: var(--serif); font-size: 200px; line-height: 0.6; height: 90px; color: var(--accent); }
  .text { font-family: var(--serif); font-style: italic; font-size: 70px; line-height: 1.22; white-space: pre-line; }
  .by { margin-top: 30px; font-size: 34px; color: var(--muted); opacity: 0; transition: opacity 500ms var(--ease) 300ms; }
  .in .by { opacity: 1; }
  .by:empty { display: none; }
`;

export default class Quote extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="q"><div class="inner"><div class="mark">“</div><div class="text"></div><div class="by"></div></div></div>'; }
  get inMs() { return 700; }
  get outMs() { return 500; }
  render(d) {
    this.text('.text', d.text);
    this.text('.by', d.by ? `— ${d.by}` : '');
    const dim = Number(d.dim);
    this.$('.q').style.setProperty('--dim', String(Number.isFinite(dim) ? Math.min(1, Math.max(0, dim)) : 0.72));
  }
}

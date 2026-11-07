// Corner bug: a short uppercase label in one corner.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .bug { position: absolute; padding: 12px 22px; background: var(--panel); border-left: 6px solid var(--accent);
    font-size: 26px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    opacity: 0; transition: opacity 400ms var(--ease); }
  .in .bug { opacity: 1; }
  .bug[data-corner="tl"] { top: 54px; left: 96px; }
  .bug[data-corner="tr"] { top: 54px; right: 96px; }
  .bug[data-corner="bl"] { bottom: 54px; left: 96px; }
  .bug[data-corner="br"] { bottom: 54px; right: 96px; }
`;

export default class CornerBug extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="bug" data-corner="tr"></div>'; }
  get inMs() { return 400; }
  get outMs() { return 400; }
  render(d) {
    this.text('.bug', d.text);
    this.$('.bug').dataset.corner = ['tl', 'tr', 'bl', 'br'].includes(d.corner) ? d.corner : 'tr';
  }
}

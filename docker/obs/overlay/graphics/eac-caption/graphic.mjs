// Caption: centred text on a dark box, at the bottom or the top.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .wrap { position: absolute; inset: 0; display: flex; justify-content: center; padding: 96px; }
  .wrap[data-place="bottom"] { align-items: flex-end; }
  .wrap[data-place="top"] { align-items: flex-start; padding-top: 80px; }
  .box { max-width: 82%; padding: 14px 28px; background: rgba(12, 10, 9, 0.78); text-align: center;
    font-size: 44px; line-height: 1.3; white-space: pre-line;
    opacity: 0; transform: translateY(16px); transition: opacity 300ms var(--ease), transform 400ms var(--ease); }
  .wrap[data-place="top"] .box { transform: translateY(-16px); }
  .in .box { opacity: 1; transform: none; }
`;

export default class Caption extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="wrap" data-place="bottom"><div class="box"></div></div>'; }
  get inMs() { return 400; }
  get outMs() { return 300; }
  render(d) {
    this.text('.box', d.text);
    this.$('.wrap').dataset.place = d.place === 'top' ? 'top' : 'bottom';
  }
}

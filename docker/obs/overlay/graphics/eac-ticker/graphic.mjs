// Ticker: a band along the bottom; the text scrolls right to left at a set
// speed, repeated so the band never runs empty.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .band { position: absolute; left: 0; right: 0; bottom: 0; height: 76px; display: flex; background: var(--panel);
    transform: translateY(100%); transition: transform 500ms var(--ease); }
  .in .band { transform: none; }
  .label { flex: none; display: grid; place-content: center; padding: 0 28px; background: var(--accent); color: #fff;
    font-weight: 600; font-size: 28px; letter-spacing: 0.08em; text-transform: uppercase; z-index: 1; }
  .label:empty { display: none; }
  .lane { position: relative; flex: 1; overflow: hidden; }
  .run { position: absolute; top: 0; bottom: 0; left: 0; display: flex; align-items: center; white-space: nowrap;
    font-size: 34px; will-change: transform; animation: scroll var(--dur, 20s) linear infinite; }
  .run span { padding-right: 120px; }
  @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(var(--shift, -50%)); } }
`;

export default class Ticker extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="band"><div class="label"></div><div class="lane"><div class="run"></div></div></div>'; }
  get inMs() { return 500; }
  get outMs() { return 500; }
  render(d) {
    this.text('.label', d.label);
    const text = String(d.text ?? '').replace(/\s+/g, ' ').trim();
    const run = this.$('.run');
    if (run.dataset.text === text && run.dataset.speed === String(d.speed)) return;
    run.dataset.text = text;
    run.dataset.speed = String(d.speed);
    // One copy's width sets the loop: enough copies to cover the lane twice,
    // shifted by exactly one copy so the loop has no seam.
    run.innerHTML = '';
    const one = document.createElement('span');
    one.textContent = text;
    run.append(one);
    const fit = (tries) => {
      const w = one.getBoundingClientRect().width;
      // Not laid out yet (the renderer may load before it attaches): try again.
      if (!w && tries > 0) return requestAnimationFrame(() => fit(tries - 1));
      if (!w) return;
      const lane = this.$('.lane').getBoundingClientRect().width || 1920;
      const copies = Math.min(40, Math.ceil(lane / w) + 1);
      for (let i = 1; i < copies; i++) run.append(one.cloneNode(true));
      const speed = Math.min(600, Math.max(30, Number(d.speed) || 120));
      run.style.setProperty('--shift', `${-w}px`);
      run.style.setProperty('--dur', `${w / speed}s`);
    };
    requestAnimationFrame(() => fit(60));
  }
}

// Lower third: name and role, bottom left, in four styles. "slash", "reveal"
// and "fade" follow the sequences of Animated Lower Thirds 1.6 by noeal-dac
// (MIT, https://github.com/noeal-dac/Animated-Lower-Thirds; LICENSE-animated-lower-thirds
// in this folder), rewritten as CSS transitions for this graphic.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .lt { position: absolute; left: 96px; bottom: 108px; display: inline-block; max-width: 1240px; }
  .bg { position: absolute; inset: 0; background: var(--panel); }
  .text { position: relative; padding: 20px 40px 22px 34px; }
  .mask { overflow: hidden; }
  .name { font-family: var(--serif); font-size: 58px; line-height: 1.12; font-weight: 500; white-space: nowrap; }
  .role { font-size: 30px; line-height: 1.3; color: var(--muted); margin-top: 2px; white-space: nowrap; }
  .role:empty { display: none; }
  .mark { position: absolute; top: 0; bottom: 0; left: -10px; width: 10px; background: var(--accent); }

  /* panel: the whole block fades and slides in. */
  .lt[data-style="panel"] { opacity: 0; transform: translateX(-60px); transition: opacity 400ms var(--ease), transform 500ms var(--ease); }
  .in .lt[data-style="panel"] { opacity: 1; transform: none; }

  /* slash: accent slash in from the right, panel opens, lines slide in from the left. */
  .lt[data-style="slash"] .mark { left: -30px; width: 14px; opacity: 0; transform: translateX(160px) skewX(-18deg);
    transition: opacity 250ms 300ms, transform 450ms 250ms var(--ease); }
  .lt[data-style="slash"] .bg { transform-origin: left; transform: scaleX(0); transition: transform 400ms 150ms var(--ease); }
  .lt[data-style="slash"] .name, .lt[data-style="slash"] .role { transform: translateX(-102%); transition: transform 420ms var(--ease); }
  .in .lt[data-style="slash"] .mark { opacity: 1; transform: skewX(-18deg); transition-delay: 0ms, 0ms; }
  .in .lt[data-style="slash"] .bg { transform: none; transition-delay: 180ms; }
  .in .lt[data-style="slash"] .name { transform: none; transition-delay: 380ms; }
  .in .lt[data-style="slash"] .role { transform: none; transition-delay: 450ms; }

  /* reveal: accent block spins in, panel opens, name rises, role drops. */
  .lt[data-style="reveal"] .mark { transform: scale(0) rotate(90deg); transition: transform 380ms 220ms var(--ease); }
  .lt[data-style="reveal"] .bg { transform-origin: left; transform: scaleX(0); transition: transform 380ms 120ms var(--ease); }
  .lt[data-style="reveal"] .name { transform: translateY(110%); transition: transform 360ms var(--ease); }
  .lt[data-style="reveal"] .role { transform: translateY(-110%); transition: transform 360ms var(--ease); }
  .in .lt[data-style="reveal"] .mark { transform: none; transition-delay: 0ms; }
  .in .lt[data-style="reveal"] .bg { transform: none; transition-delay: 160ms; }
  .in .lt[data-style="reveal"] .name, .in .lt[data-style="reveal"] .role { transform: none; transition-delay: 480ms; }

  /* fade: panel fades in, lines rise. */
  .lt[data-style="fade"] .bg, .lt[data-style="fade"] .mark { opacity: 0; transition: opacity 350ms 150ms; }
  .lt[data-style="fade"] .name, .lt[data-style="fade"] .role { transform: translateY(110%); transition: transform 380ms var(--ease); }
  .in .lt[data-style="fade"] .bg, .in .lt[data-style="fade"] .mark { opacity: 1; transition-delay: 0ms; }
  .in .lt[data-style="fade"] .name { transform: none; transition-delay: 220ms; }
  .in .lt[data-style="fade"] .role { transform: none; transition-delay: 290ms; }
`;

const STYLES = ['panel', 'slash', 'reveal', 'fade'];

export default class LowerThird extends EacGraphic {
  get css() { return CSS; }
  get html() {
    return '<div class="lt" data-style="panel"><div class="mark"></div><div class="bg"></div>'
      + '<div class="text"><div class="mask"><div class="name"></div></div><div class="mask"><div class="role"></div></div></div></div>';
  }
  get inMs() { return 900; }
  get outMs() { return 700; }
  render(d) {
    this.$('.lt').dataset.style = STYLES.includes(d.style) ? d.style : 'panel';
    this.text('.name', d.name);
    this.text('.role', d.title);
  }
}

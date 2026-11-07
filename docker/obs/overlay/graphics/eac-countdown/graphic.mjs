// Countdown: label and mm:ss (h:mm:ss past an hour), bottom right. The clock
// starts when the graphic is played; changing the minutes while it runs, or
// the "restart" action, starts it again.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const CSS = `
  .cd { position: absolute; right: 96px; bottom: 108px; display: flex; align-items: baseline; gap: 22px;
    background: var(--panel); padding: 18px 36px; border-bottom: 6px solid var(--accent);
    opacity: 0; transform: translateY(30px); transition: opacity 400ms var(--ease), transform 500ms var(--ease); }
  .in .cd { opacity: 1; transform: none; }
  .label { font-size: 34px; color: var(--muted); }
  .label:empty { display: none; }
  .time { font-family: var(--serif); font-size: 72px; font-variant-numeric: tabular-nums; line-height: 1; }
`;
const pad = (n) => String(n).padStart(2, '0');

export default class Countdown extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="cd"><span class="label"></span><span class="time">00:00</span></div>'; }
  render(d) {
    this.text('.label', d.label);
    if (this.timer && d.minutes !== this.minutes) this.start();
    this.tick();
  }
  start() {
    this.minutes = this.data.minutes;
    this.target = Date.now() + Math.max(0, Number(this.data.minutes) || 0) * 60_000;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }
  tick() {
    const left = this.target ? Math.max(0, Math.round((this.target - Date.now()) / 1000)) : Math.round((Number(this.data.minutes) || 0) * 60);
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    this.text('.time', h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
  }
  onPlay() { this.start(); }
  onStop() {
    clearInterval(this.timer);
    this.timer = null;
    this.target = null;
  }
  onCustom(id) {
    if (id !== 'restart') return { statusCode: 404, statusMessage: 'No such action' };
    if (this.timer) this.start();
    return { statusCode: 200 };
  }
}

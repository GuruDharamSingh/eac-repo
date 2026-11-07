// Viewer chat: the newest messages from the stream's destinations, stacked in
// a corner. While playing it reads ../../chat (the OBS agent passes the
// stream-chat collector's /recent) every two seconds and shows the last
// `count` messages: new ones slide in, ones pushed out, deleted by a
// moderator or past `hold` seconds fade away. Chat text is untrusted, so it
// is only ever set as textContent.
import { EacGraphic } from '../_lib/eac-graphic.mjs';

const POLL_MS = 2000;
const PLACES = new Set(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
const PLATFORMS = {
  twitch: { label: 'Twitch', bg: '#9146ff', fg: '#fff' },
  youtube: { label: 'YouTube', bg: '#ff0033', fg: '#fff' },
  kick: { label: 'Kick', bg: '#53fc18', fg: '#0b0e0f' },
  facebook: { label: 'Facebook', bg: '#1877f2', fg: '#fff' },
};
const SAMPLE = [
  { id: 's1', platform: 'twitch', author: 'night_owl_42', colour: '#1E90FF', body: 'Hello from Lisbon! The sound is great tonight.', amount: null },
  { id: 's2', platform: 'youtube', author: 'Maria Okafor', colour: null, body: 'Will the recording be posted afterwards?', amount: null },
  { id: 's3', platform: 'youtube', author: 'Samir', colour: null, body: 'For the collective. Thank you all.', amount: 'CA$5.00' },
];

const CSS = `
  .box { position: absolute; width: 600px; display: flex; flex-direction: column; gap: 10px;
    opacity: 0; transition: opacity 400ms var(--ease); }
  .in .box { opacity: 1; }
  .box[data-place="bottom-left"] { left: 64px; bottom: 64px; }
  .box[data-place="bottom-right"] { right: 64px; bottom: 64px; align-items: flex-end; }
  .box[data-place="top-left"] { left: 64px; top: 64px; }
  .box[data-place="top-right"] { right: 64px; top: 64px; align-items: flex-end; }
  .title { align-self: flex-start; background: var(--accent); color: #fff; font-weight: 600; font-size: 22px; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 6px 16px; border-radius: 4px; }
  .box[data-place$="right"] .title { align-self: flex-end; }
  .title:empty { display: none; }
  .list { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .msg { box-sizing: border-box; background: var(--panel); border-left: 4px solid var(--accent); border-radius: 6px;
    padding: 10px 18px 12px; font-size: 26px; line-height: 1.3;
    transition: opacity 400ms var(--ease), transform 400ms var(--ease); }
  .msg.new { opacity: 0; transform: translateY(16px); }
  .msg.gone { opacity: 0; transform: translateX(-24px); }
  .box[data-place$="right"] .msg.gone { transform: translateX(24px); }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; font-size: 22px; }
  .badge { flex: none; font-size: 15px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 3px; }
  .nobadges .badge { display: none; }
  .author { font-weight: 600; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .amount { flex: none; margin-left: auto; background: var(--accent); color: #fff; font-weight: 600; padding: 2px 10px;
    border-radius: 4px; white-space: nowrap; }
  .body { overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
`;

const clamp = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const keyOf = (m) => `${m.platform}:${m.id}`;

/** A platform name colour, lightened until it reads on the dark panel; null for none. */
function readable(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return null;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  for (let i = 0; i < 4 && (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5; i++) {
    [r, g, b] = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.35));
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export default class Chat extends EacGraphic {
  get css() { return CSS; }
  get html() { return '<div class="box"><div class="title"></div><div class="list"></div></div>'; }
  get inMs() { return 400; }
  get outMs() { return 400; }

  constructor() {
    super();
    this.latest = []; // the last read, oldest first
    this.cards = new Map(); // key → element on screen
    this.seen = new Map(); // key → when it first appeared (for hold)
    this.sampleUntil = 0;
    this.timer = null;
    this.busy = false;
  }

  render(d) {
    const box = this.$('.box');
    box.dataset.place = PLACES.has(d.place) ? d.place : 'bottom-left';
    box.classList.toggle('nobadges', d.badges === false);
    this.text('.title', d.title);
    this.paint();
  }

  onPlay() {
    clearInterval(this.timer);
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  onStop() {
    clearInterval(this.timer);
    this.timer = null;
    for (const el of this.cards.values()) el.remove();
    this.cards.clear();
    this.seen.clear();
    this.latest = [];
  }

  onCustom(id) {
    if (id !== 'sample') return { statusCode: 404, statusMessage: 'No such action' };
    this.sampleUntil = Date.now() + 10_000;
    this.paint();
    setTimeout(() => this.paint(), 10_050);
    return { statusCode: 200 };
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const count = clamp(this.data.count, 1, 10, 5);
      // Ask for more than fits, so a platform filter still fills the stack.
      const q = new URLSearchParams({ minutes: String(clamp(this.data.minutes, 1, 720, 10)), limit: String(count * 4) });
      const r = await fetch(new URL(`chat?${q}`, document.baseURI), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        this.latest = Array.isArray(j.messages) ? j.messages : [];
      }
    } catch {
      // Collector or agent away: keep what is on screen and try again.
    } finally {
      this.busy = false;
    }
    if (this.timer) this.paint();
  }

  paint() {
    if (!this.$root) return;
    const d = this.data;
    const now = Date.now();
    const sample = now < this.sampleUntil;
    let list = sample ? SAMPLE : this.latest;
    if (!sample && d.platform && d.platform !== 'all') list = list.filter((m) => m.platform === d.platform);
    list = list.slice(-clamp(d.count, 1, 10, 5));
    const hold = clamp(d.hold, 0, 600, 0) * 1000;
    for (const m of list) if (!this.seen.has(keyOf(m))) this.seen.set(keyOf(m), now);
    if (hold) list = list.filter((m) => now - this.seen.get(keyOf(m)) < hold);
    // Forget first-seen times of messages that left the read window.
    const inRead = new Set([...this.latest, ...SAMPLE].map(keyOf));
    for (const k of this.seen.keys()) if (!inRead.has(k)) this.seen.delete(k);

    const want = new Set(list.map(keyOf));
    for (const [k, el] of this.cards) {
      if (want.has(k)) continue;
      this.cards.delete(k);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 420);
    }
    const host = this.$('.list');
    for (const m of list) {
      const k = keyOf(m);
      if (this.cards.has(k)) continue;
      const el = this.card(m);
      el.classList.add('new');
      host.append(el);
      this.cards.set(k, el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('new')));
    }
  }

  card(m) {
    const el = document.createElement('div');
    el.className = 'msg';
    const head = document.createElement('div');
    head.className = 'head';
    const p = PLATFORMS[m.platform];
    if (p) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = p.label;
      badge.style.background = p.bg;
      badge.style.color = p.fg;
      head.append(badge);
    }
    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = String(m.author ?? '');
    const colour = readable(m.colour);
    if (colour) author.style.color = colour;
    head.append(author);
    if (m.amount) {
      const amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = String(m.amount);
      head.append(amount);
    }
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = String(m.body ?? '');
    el.append(head, body);
    return el;
  }
}

// Shared base for the collective's OGraf graphics (docker/obs/overlay/graphics/eac-*).
// Implements the OGraf v1 Graphic contract once: load, playAction (step
// rules), stopAction, updateAction, customAction, dispose. A subclass gives
// `css`, `html`, `stepCount`, `render(data)` and, if it animates longer than
// the default, `inMs` / `outMs`. Content goes in a shadow root; web fonts are
// loaded once into the document, since @font-face does not apply inside one.

const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=IBM+Plex+Sans:wght@400;600&display=swap';
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

export const BASE_CSS = `
  :host { all: initial; position: absolute; inset: 0; display: block; pointer-events: none;
    --accent: #8a6d1f; --panel: rgba(20, 17, 16, 0.88); --ink: #f3efe7; --muted: #cfc7b8;
    --serif: "Newsreader", "DejaVu Serif", Georgia, serif; --sans: "IBM Plex Sans", "DejaVu Sans", Arial, sans-serif;
    --ease: cubic-bezier(.2, .7, .2, 1); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .root { position: absolute; inset: 0; }
  .instant, .instant * { transition: none !important; animation-duration: 0s !important; animation-delay: 0s !important; }
`;

export class EacGraphic extends HTMLElement {
  /** Overridden by subclasses. */
  get css() { return ''; }
  get html() { return ''; }
  get stepCount() { return 1; }
  get inMs() { return 600; }
  get outMs() { return 450; }
  render(_data) {}
  onPlay() {}
  onStop() {}
  onCustom(_id, _payload) { return { statusCode: 404, statusMessage: 'No such action' }; }

  constructor() {
    super();
    this.data = {};
    this.currentStep = undefined;
  }

  async load({ data } = {}) {
    if (!document.querySelector('link[data-eac-fonts]')) {
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS });
      link.dataset.eacFonts = '';
      document.head.append(link);
    }
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${BASE_CSS}${this.css}</style><div class="root">${this.html}</div>`;
    this.$root = root.querySelector('.root');
    this.data = { ...(data ?? {}) };
    this.applyAccent();
    this.render(this.data);
    await document.fonts?.ready;
    return { statusCode: 200 };
  }

  $(sel) { return this.$root.querySelector(sel); }
  text(sel, value) {
    const el = this.$(sel);
    const v = String(value ?? '');
    if (el && el.textContent !== v) el.textContent = v;
  }
  applyAccent() {
    if (/^#[0-9a-f]{6}$/i.test(this.data.accent ?? '')) this.style.setProperty('--accent', this.data.accent);
  }

  async animate(on, skipAnimation) {
    this.$root.classList.toggle('instant', !!skipAnimation);
    if (skipAnimation) void this.$root.offsetWidth;
    this.$root.classList.toggle('out', !on);
    this.$root.classList.toggle('in', on);
    if (!skipAnimation) await sleep(on ? this.inMs : this.outMs);
  }

  async playAction({ goto, delta, skipAnimation } = {}) {
    const target = Number.isInteger(goto) && goto >= 0 ? goto : (this.currentStep ?? -1) + (Number.isInteger(delta) ? delta : 1);
    if (this.stepCount >= 0 && target >= this.stepCount) {
      await this.stopAction({ skipAnimation });
      return { statusCode: 200, currentStep: undefined };
    }
    const first = this.currentStep === undefined;
    this.currentStep = Math.max(0, target);
    this.$root.dataset.step = String(this.currentStep);
    if (first) {
      this.onPlay();
      await this.animate(true, skipAnimation);
    }
    return { statusCode: 200, currentStep: this.currentStep };
  }

  async stopAction({ skipAnimation } = {}) {
    this.currentStep = undefined;
    await this.animate(false, skipAnimation);
    this.onStop();
    return { statusCode: 200 };
  }

  async updateAction({ data } = {}) {
    this.data = { ...this.data, ...(data ?? {}) };
    this.applyAccent();
    this.render(this.data);
    return { statusCode: 200 };
  }

  async customAction({ id, payload } = {}) {
    return this.onCustom(id, payload) ?? { statusCode: 200 };
  }

  async dispose() {
    this.onStop();
    if (this.shadowRoot) this.shadowRoot.innerHTML = '';
    return { statusCode: 200 };
  }
}

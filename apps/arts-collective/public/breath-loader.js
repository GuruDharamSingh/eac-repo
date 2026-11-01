/*
 * <breath-loader>: a box-breathing loading screen. Framework-free Web Component, no dependencies.
 * Full API: README.md in this folder. Origin: the Pureland web shell (godot/web/shell.html).
 *
 * A dot of light travels round a square: first an extended exhale along the bottom (two phases
 * long, once), then breathe in up the left, hold across the top, breathe out down the right, hold
 * along the bottom, repeating. Light gathers on the in-breath and softens on the out-breath; the
 * outline completes in gold with progress. Everything moves by CSS transform/opacity keyframes only,
 * so the compositor keeps it breathing while the main thread is blocked (wasm compile, engine start).
 *
 * The CSS between the CSS-BEGIN/CSS-END markers is the single source: scripts/export-web-release.sh
 * inlines it into the Godot shell (minus the EMBED-ONLY rules), which uses the same markup without
 * this script.
 */
(function () {
	'use strict';
	if (typeof window === 'undefined' || !window.customElements || window.customElements.get('breath-loader')) {
		return;
	}

	const CSS = /* CSS-BEGIN */`
.bl {
	--a: var(--breath-accent, #d4b061);
	--g: var(--breath-glow, #e9a443);
	--x: var(--breath-text, #f2e6c7);
	--p: var(--breath-phase, 4s);
	position: absolute;
	inset: 0;
	overflow: hidden;
	container-type: size;
	background: var(--breath-backdrop, radial-gradient(ellipse 70% 55% at 50% 42%, #6e212547, transparent 70%), radial-gradient(ellipse 120% 90% at 50% 40%, #2b2463, #1c1d4a 42%, #0d0e24));
	color: var(--x);
	font: 16px/1.5 var(--breath-font, "Noto Serif", Georgia, serif);
	transition: opacity var(--breath-fade, 1.2s) ease;
}
/* EMBED-ONLY */
.bl[data-theme=light] {
	--a: var(--breath-accent, #9c7526);
	--g: var(--breath-glow, #dc8f22);
	--x: var(--breath-text, #3b2b1e);
	background: var(--breath-backdrop, radial-gradient(ellipse 70% 55% at 50% 42%, #e9a44329, transparent 70%), radial-gradient(ellipse 120% 90% at 50% 40%, #fdf8ec, #f4e9d0 50%, #e6d5b0));
}
@media (prefers-color-scheme: light) {
	.bl:not([data-theme]), .bl[data-theme=auto] {
		--a: var(--breath-accent, #9c7526);
		--g: var(--breath-glow, #dc8f22);
		--x: var(--breath-text, #3b2b1e);
		background: var(--breath-backdrop, radial-gradient(ellipse 70% 55% at 50% 42%, #e9a44329, transparent 70%), radial-gradient(ellipse 120% 90% at 50% 40%, #fdf8ec, #f4e9d0 50%, #e6d5b0));
	}
}
.bl.tr { background: none; }
.bl.ind .e { display: none; }
.bl.still .d { display: none; }
.bl.still .f0 { display: none; }
.bl.still .f { animation: none; opacity: .3; }
/* /EMBED-ONLY */
.bl.done { opacity: 0; pointer-events: none; }
.bl .st {
	--s: min(52vw, 46vh, var(--breath-size, 248px));
	height: 100%;
	box-sizing: border-box;
	padding: 16px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: calc(var(--s) * .2);
}
@supports (width: 1cqw) {
	.bl .st { --s: min(52cqw, 46cqh, var(--breath-size, 248px)); }
}
.bl .q { position: relative; width: var(--s); height: var(--s); flex: none; }
.bl .q > div { position: absolute; inset: 0; }
/* Every element has ONE animation: two on the same element and property (intro + loop) drop off
   the compositor and freeze while the main thread is busy. So the intro and the loop are separate
   layers (.f0/.f) or nested tracks (.t0 > .t) whose transforms compose. */
/* light: the 8 s exhale first (.f0), then gathers on the in-breath, softens on the out-breath (.f) */
.bl .f, .bl .f0 {
	background: radial-gradient(circle, var(--g), transparent 72%);
	box-shadow: 0 0 34px var(--g);
	border-radius: 3px;
	opacity: 0;
}
.bl .f0 { animation: bl-x calc(var(--p) * 2) ease-in-out; }
.bl .f { animation: bl-f calc(var(--p) * 4) ease-in-out calc(var(--p) * 2) infinite; }
@keyframes bl-x { 0% { opacity: .45 } to { opacity: .04 } }
@keyframes bl-f { 0%, 75%, to { opacity: .04 } 25%, 50% { opacity: .45 } }
.bl .o { border-radius: 3px; }
.bl .o { border: 1.5px solid var(--a); opacity: .4; }
/* progress: four gold edges scaled by --progress (0..1), in the dot's direction from bottom-left */
.bl .e { position: absolute; background: var(--a); box-shadow: 0 0 3px var(--g); transition: transform .6s ease; }
.bl .e1 { left: 0; top: 0; bottom: 0; width: 1.5px; transform-origin: bottom; transform: scaleY(clamp(0, var(--progress, 0) * 4, 1)); }
.bl .e2 { left: 0; top: 0; right: 0; height: 1.5px; transform-origin: left; transform: scaleX(clamp(0, var(--progress, 0) * 4 - 1, 1)); }
.bl .e3 { right: 0; top: 0; bottom: 0; width: 1.5px; transform-origin: top; transform: scaleY(clamp(0, var(--progress, 0) * 4 - 2, 1)); }
.bl .e4 { left: 0; right: 0; bottom: 0; height: 1.5px; transform-origin: right; transform: scaleX(clamp(0, var(--progress, 0) * 4 - 3, 1)); }
/* the dot rides square-sized tracks; translate % is the track's own size, so no variables in
   keyframes. .t0 carries the intro (bottom edge, right to left), .t inside it the laps. */
.bl .t0 { animation: bl-i calc(var(--p) * 2) linear; will-change: transform; }
.bl .t {
	position: absolute;
	inset: 0;
	transform: translate(0, 100%);
	animation: bl-t calc(var(--p) * 4) linear calc(var(--p) * 2) infinite;
	will-change: transform;
}
@keyframes bl-i { 0% { transform: translateX(100%) } to { transform: none } }
@keyframes bl-t {
	0%, to { transform: translate(0, 100%) }
	25% { transform: translate(0, 0) }
	50% { transform: translate(100%, 0) }
	75% { transform: translate(100%, 100%) }
}
.bl .d {
	position: absolute;
	left: -6px;
	top: -6px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: radial-gradient(circle, #fff6dc, var(--g) 55%, transparent 75%);
	box-shadow: 0 0 12px 4px #e9a4438c, 0 0 30px 8px #e9a44333;
}
/* words: "Breathe out" for the first 8 s, then the four phases and a count of four */
.bl .w { display: grid; place-items: center; text-align: center; }
.bl .w > * { grid-area: 1/1; opacity: 0; }
.bl .h {
	font-size: calc(var(--s) * .105);
	letter-spacing: .06em;
	white-space: nowrap;
	transform: translateY(-.55em);
	animation: bl-h calc(var(--p) * 4) calc(var(--p) * var(--i)) infinite;
}
.bl .h0 { animation: bl-h0 calc(var(--p) * 2); }
@keyframes bl-h { 0%, 25%, to { opacity: 0 } 4%, 21% { opacity: .95 } }
@keyframes bl-h0 { 0%, to { opacity: 0 } 8%, 90% { opacity: .95 } }
.bl .c {
	font-size: calc(var(--s) * .085);
	color: var(--a);
	transform: translateY(.95em);
	font-variant-numeric: tabular-nums;
	animation: bl-c var(--p) calc(var(--p) * (2 + var(--i) / 4)) infinite;
}
@keyframes bl-c { 0%, 25%, to { opacity: 0 } 6%, 19% { opacity: .6 } }
/* caption, progress detail, error notice */
.bl .l { font-size: clamp(15px, 4.2cqw, 19px); color: var(--a); letter-spacing: .08em; text-align: center; }
.bl .m { font-size: 13px; opacity: .55; min-height: 1.5em; text-align: center; font-variant-numeric: tabular-nums; }
.bl .n { max-width: min(86%, 520px); padding: 14px 18px; border: 1px solid var(--a); border-radius: 6px; background: #6e212559; white-space: pre-line; text-align: center; }
.bl .n:empty { display: none; }
/* reduced motion (or the "still" class above): a still square, only the words change */
@media (prefers-reduced-motion: reduce) {
	.bl .d { display: none; }
	.bl .f0 { display: none; }
	.bl .f { animation: none; opacity: .3; }
	.bl .e { transition: none; }
}
`/* CSS-END */;

	// Same markup as the Godot shell's #loader (godot/web/shell.html), minus the text.
	const HTML = '<div class="bl" part="loader"><div class="st"><div class="q" aria-hidden="true">' +
		'<div class="f0"></div><div class="f"></div><div class="o"></div>' +
		'<i class="e e1"></i><i class="e e2"></i><i class="e e3"></i><i class="e e4"></i>' +
		'<div class="w"><span class="h h0"></span><span class="h" style="--i:2"></span><span class="h" style="--i:3"></span>' +
		'<span class="h" style="--i:4"></span><span class="h" style="--i:5"></span>' +
		'<span class="c" style="--i:0">1</span><span class="c" style="--i:1">2</span><span class="c" style="--i:2">3</span><span class="c" style="--i:3">4</span></div>' +
		'<div class="t0"><div class="t"><i class="d"></i></div></div></div>' +
		'<div><div class="l" part="label"></div><div class="m" part="detail"></div></div><div class="n" part="notice" role="alert"></div></div></div>';

	const HOST = ':host{display:block;position:relative;width:100%;height:100%;min-height:var(--breath-min-height,280px)}' +
		':host([hidden]){display:none}' +
		':host([fullscreen]){position:fixed;inset:0;width:auto;height:auto;min-height:0;z-index:var(--breath-z,1000)}';

	const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];

	/** Milliseconds until the current breath phase ends (the 2-phase intro counts as one). */
	function untilPhaseEnd(bl) {
		const a = bl.querySelector('.t').getAnimations().find((x) => x.animationName === 'bl-t');
		if (!a || a.currentTime == null) {
			return 0;
		}
		const p = a.effect.getComputedTiming().duration / 4;
		const t = Number(a.currentTime);
		return t < 2 * p ? 2 * p - t : p - ((t - 2 * p) % p);
	}

	function mb(bytes) {
		return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0);
	}

	class BreathLoader extends HTMLElement {
		static get observedAttributes() {
			return ['progress', 'loaded', 'total', 'label', 'detail', 'error', 'phases', 'phase-seconds', 'size',
				'theme', 'indeterminate', 'still', 'transparent', 'fade-ms'];
		}

		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			root.innerHTML = '<style>' + HOST + CSS + '</style>' + HTML;
			this._bl = root.querySelector('.bl');
			this._q = (s) => root.querySelector(s);
			this._words = root.querySelectorAll('.h');
			this._loaded = 0;
			this._total = 0;
			this._detail = null;
			this._fade = 1200;
			this.phases = PHASES;
		}

		connectedCallback() {
			// Properties set before the element was defined (e.g. by a framework) shadow the setters.
			for (const k of ['progress', 'loaded', 'total', 'label', 'detail', 'error', 'phases']) {
				if (Object.prototype.hasOwnProperty.call(this, k)) {
					const v = this[k];
					delete this[k];
					this[k] = v;
				}
			}
			if (!this.hasAttribute('role')) {
				this.setAttribute('role', 'status');
				this.setAttribute('aria-live', 'polite');
			}
			requestAnimationFrame(() => requestAnimationFrame(() => {
				if (!this._ready && this.isConnected) {
					this._ready = true;
					this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
				}
			}));
		}

		attributeChangedCallback(name, _old, v) {
			const on = v !== null;
			const css = (k, val) => (val == null ? this._bl.style.removeProperty(k) : this._bl.style.setProperty(k, val));
			switch (name) {
			case 'progress': this.progress = v && v.endsWith('%') ? parseFloat(v) / 100 : v; break;
			case 'loaded': this.loaded = v; break;
			case 'total': this.total = v; break;
			case 'label': this.label = v; break;
			case 'detail': this.detail = v; break;
			case 'error': this.error = v; break;
			case 'phases': this.phases = v ? v.split('|') : PHASES; break;
			case 'phase-seconds': css('--breath-phase', on ? parseFloat(v) + 's' : null); break;
			case 'size': css('--breath-size', on ? (/^[\d.]+$/.test(v) ? v + 'px' : v) : null); break;
			case 'fade-ms': this._fade = on ? parseFloat(v) || 0 : 1200; css('--breath-fade', this._fade + 'ms'); break;
			case 'theme': on ? this._bl.setAttribute('data-theme', v) : this._bl.removeAttribute('data-theme'); break;
			case 'indeterminate': this._bl.classList.toggle('ind', on); break;
			case 'still': this._bl.classList.toggle('still', on); break;
			case 'transparent': this._bl.classList.toggle('tr', on); break;
			}
		}

		/** Fraction done, 0..1 (drives the gold outline through one CSS variable). */
		get progress() { return this._progress || 0; }
		set progress(v) {
			this._progress = Math.max(0, Math.min(1, Number(v) || 0));
			this._bl.style.setProperty('--progress', this._progress);
		}

		/** Bytes so far and in total: set progress and the "12 of 106 MB" detail line. */
		get loaded() { return this._loaded; }
		set loaded(v) { this._loaded = Number(v) || 0; this._bytes(); }
		get total() { return this._total; }
		set total(v) { this._total = Number(v) || 0; this._bytes(); }

		get label() { return this._q('.l').textContent; }
		set label(v) { this._q('.l').textContent = v == null ? '' : v; }

		/** Second caption line; null derives it from loaded/total. */
		get detail() { return this._detail; }
		set detail(v) { this._detail = v == null ? null : String(v); this._bytes(); }

		/** Error text in a notice under the caption ('' hides it). */
		get error() { return this._q('.n').textContent; }
		set error(v) { this._q('.n').textContent = v == null ? '' : v; }

		/** The four phase words; the intro shows the third (the exhale). */
		get phases() { return this._phases.slice(); }
		set phases(v) {
			this._phases = PHASES.map((d, i) => (Array.isArray(v) && v[i] != null ? String(v[i]) : d));
			const w = this._words;
			w[0].textContent = this._phases[2];
			for (let i = 0; i < 4; i++) {
				w[i + 1].textContent = this._phases[i];
			}
		}

		get dismissed() { return Boolean(this._dismissing); }

		/** Milliseconds until the current breath phase ends. */
		untilPhaseEnd() { return untilPhaseEnd(this._bl); }

		/**
		 * Fades out at the end of the current breath phase ({ wait: false } fades now), fires
		 * "dismissed", and removes the element if it has remove-on-dismiss. Returns a promise.
		 */
		dismiss(options) {
			if (!this._dismissing) {
				const wait = !options || options.wait !== false ? untilPhaseEnd(this._bl) : 0;
				this._dismissing = new Promise((resolve) => {
					setTimeout(() => {
						this._bl.classList.add('done');
						this.style.pointerEvents = 'none';
						setTimeout(() => {
							this.dispatchEvent(new CustomEvent('dismissed', { bubbles: true, composed: true }));
							if (this.hasAttribute('remove-on-dismiss')) {
								this.remove();
							}
							resolve();
						}, this._fade + 20);
					}, wait);
				});
			}
			return this._dismissing;
		}

		_bytes() {
			if (this._total > 0) {
				this.progress = this._loaded / this._total;
			}
			let d = this._detail;
			if (d == null) {
				d = this._loaded > 0 ? mb(this._loaded) + (this._total > 0 ? ' of ' + mb(this._total) : '') + ' MB' : '';
			}
			this._q('.m').textContent = d;
		}
	}

	window.customElements.define('breath-loader', BreathLoader);
}());

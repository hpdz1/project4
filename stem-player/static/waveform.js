// Waveform canvas for one stem, drawn from peaks.json (values 0..1 per bucket).
// DPR-aware, redraws on resize, played part tinted in the stem colour, playhead line,
// click/drag to seek. The bar graphics are pre-rendered into two offscreen canvases
// (dim + bright) so each animation frame is just two drawImage calls and a line.

import { clamp } from './util.js';

const BAR_W = 2; // css px
const BAR_GAP = 1; // css px

export class Waveform {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{color: string, peaks?: number[]|null, onScrub?: (f:number)=>void,
   *          onSeek?: (f:number)=>void}} opts  onScrub: while dragging; onSeek: on release
   */
  constructor(canvas, { color, peaks = null, onScrub, onSeek } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.color = color || '#a3abb8';
    this.peaks = Array.isArray(peaks) ? peaks : null;
    this.progress = 0;
    this.interactive = false;
    this.onScrub = onScrub;
    this.onSeek = onSeek;
    this._dpr = 0;
    this._w = 0;
    this._h = 0;
    this._dim = null;
    this._bright = null;
    this._dragId = null;
    this._lastFrac = 0;
    this._destroyed = false;

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);

    this._onDown = (e) => this._pointerDown(e);
    this._onMove = (e) => this._pointerMove(e);
    this._onUp = (e) => this._pointerUp(e, true);
    this._onCancel = (e) => this._pointerUp(e, false);
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerup', this._onUp);
    canvas.addEventListener('pointercancel', this._onCancel);
    canvas.addEventListener('lostpointercapture', this._onCancel);
    this.resize();
  }

  setPeaks(peaks) {
    this.peaks = Array.isArray(peaks) ? peaks : null;
    this._prerender();
    this.draw();
  }

  setColor(color) {
    this.color = color;
    this._prerender();
    this.draw();
  }

  setInteractive(on) {
    this.interactive = !!on;
    this.canvas.classList.toggle('is-interactive', this.interactive);
  }

  /** f in 0..1. Only repaints when the playhead moved at least ~half a device pixel. */
  setProgress(f) {
    f = clamp(Number(f) || 0, 0, 1);
    if ((window.devicePixelRatio || 1) !== this._dpr) {
      this.progress = f;
      this.resize();
      return;
    }
    if (Math.abs(f - this.progress) * this._w < 0.5) return;
    this.progress = f;
    this.draw();
  }

  resize() {
    if (this._destroyed) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this._w && h === this._h && dpr === this._dpr && this._dim) return;
    this._dpr = dpr;
    this._w = w;
    this._h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this._prerender();
    this.draw();
  }

  _prerender() {
    const w = this._w;
    const h = this._h;
    if (!w || !h) return;
    this._dim = this._renderBars(w, h, this.color, 0.32);
    this._bright = this._renderBars(w, h, this.color, 1);
  }

  _renderBars(w, h, color, alpha) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const dpr = this._dpr;
    const mid = h / 2;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    const peaks = this.peaks;
    if (!peaks || !peaks.length) {
      // No peaks (yet): a thin centre line.
      g.fillRect(0, Math.round(mid - dpr / 2), w, Math.max(1, Math.round(dpr)));
      return c;
    }
    const barW = Math.max(1, Math.round(BAR_W * dpr));
    const step = Math.max(barW + 1, Math.round((BAR_W + BAR_GAP) * dpr));
    const bars = Math.max(1, Math.floor(w / step));
    const n = peaks.length;
    const maxAmp = mid - Math.max(1, Math.round(2 * dpr));
    const minH = Math.max(1, Math.round(dpr));
    for (let i = 0; i < bars; i++) {
      const a = Math.floor((i * n) / bars);
      const b = Math.max(a + 1, Math.floor(((i + 1) * n) / bars));
      let v = 0;
      for (let j = a; j < b && j < n; j++) {
        const p = Math.abs(Number(peaks[j]) || 0);
        if (p > v) v = p;
      }
      v = Math.min(1, v);
      // Mild curve so quiet parts are still visible without faking loudness.
      const amp = Math.max(minH / 2, Math.pow(v, 0.8) * maxAmp);
      const x = i * step;
      g.fillRect(x, Math.round(mid - amp), barW, Math.max(minH, Math.round(amp * 2)));
    }
    return c;
  }

  draw() {
    if (this._destroyed) return;
    const g = this.g;
    const w = this._w;
    const h = this._h;
    if (!w || !h) return;
    g.clearRect(0, 0, w, h);
    if (this._dim) g.drawImage(this._dim, 0, 0);
    const px = Math.round(this.progress * w);
    if (this._bright && px > 0) g.drawImage(this._bright, 0, 0, px, h, 0, 0, px, h);
    // Playhead
    const lw = Math.max(1, Math.round(2 * this._dpr));
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(Math.min(w - lw, Math.max(0, px - Math.floor(lw / 2))), 0, lw, h);
  }

  _frac(e) {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  }

  _pointerDown(e) {
    if (!this.interactive || e.button !== 0) return;
    e.preventDefault();
    this._dragId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this._lastFrac = this._frac(e);
    if (this.onScrub) this.onScrub(this._lastFrac);
  }

  _pointerMove(e) {
    if (this._dragId === null || e.pointerId !== this._dragId) return;
    this._lastFrac = this._frac(e);
    if (this.onScrub) this.onScrub(this._lastFrac);
  }

  _pointerUp(e, commit) {
    if (this._dragId === null || e.pointerId !== this._dragId) return;
    this._dragId = null;
    if (commit) {
      this._lastFrac = this._frac(e);
      if (this.onSeek) this.onSeek(this._lastFrac);
    } else if (this.onSeek) {
      // Capture lost (e.g. window blur): commit where the drag last was.
      this.onSeek(this._lastFrac);
    }
  }

  destroy() {
    this._destroyed = true;
    this._ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointermove', this._onMove);
    c.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointercancel', this._onCancel);
    c.removeEventListener('lostpointercapture', this._onCancel);
    this._dim = null;
    this._bright = null;
  }
}

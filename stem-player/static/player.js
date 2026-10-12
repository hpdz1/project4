// Audio engine: one shared AudioContext; per stem
//   AudioBufferSourceNode -> GainNode (stem) -> GainNode (master) -> destination.
// All sources of a play/seek are started at the same context time
// t0 = ctx.currentTime + 0.05 with the same offset, so the parts stay sample-locked.

import { clamp } from './util.js';

const LEAD = 0.05; // seconds between scheduling and start (DESIGN: currentTime + 0.05)
const GAIN_TC = 0.01; // gain smoothing time constant (DESIGN: setTargetAtTime(…, 0.01))
const FADE_TC = 0.005; // tiny fades on start/stop/seek so they never click
const STOP_AFTER = 0.035; // stop a faded-out source after ~7 time constants

let sharedCtx = null;
let autoResumeInstalled = false;

/** The single AudioContext for the whole page (created lazily). */
export function getAudioContext() {
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      throw new Error('This browser cannot play audio here. Please use Microsoft Edge, Chrome or Firefox.');
    }
    try {
      // Stems are 44.1 kHz; matching avoids resampling 6 big buffers while decoding.
      sharedCtx = new AC({ sampleRate: 44100 });
    } catch {
      sharedCtx = new AC();
    }
  }
  installAutoResume();
  return sharedCtx;
}

/** Browsers start audio "suspended" until the user interacts; resume on any gesture. */
export function installAutoResume() {
  if (autoResumeInstalled) return;
  autoResumeInstalled = true;
  const resume = () => {
    if (sharedCtx && sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, resume, { capture: true, passive: true });
  }
}

export class StemEngine extends EventTarget {
  constructor() {
    super();
    this.ctx = getAudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.masterVolume = 1;
    /** @type {Map<string, any>} */
    this.stems = new Map();
    this.duration = 0;
    this.playing = false;
    this.loop = false;
    this._offset = 0; // song position (s) at context time _t0
    this._t0 = 0;
    this._gen = 0; // bumps on every start/stop so stale "ended" events are ignored
    this._disposed = false;
    this._abort = new AbortController();
  }

  // ---------------------------------------------------------------- stems

  addStem(name, { volume = 1, enabled = true } = {}) {
    if (this.stems.has(name)) return this.stems.get(name);
    const gain = this.ctx.createGain();
    gain.connect(this.master);
    const s = {
      name,
      buffer: null,
      gain,
      source: null,
      volume: clamp(volume, 0, 2),
      muted: false,
      soloed: false,
      enabled,
      status: 'idle', // idle | loading | ready | error
      error: null,
      promise: null,
    };
    this.stems.set(name, s);
    this._applyGains();
    return s;
  }

  get isReady() {
    if (this._disposed || this.duration <= 0) return false;
    for (const s of this.stems.values()) if (s.buffer) return true;
    return false;
  }

  /** Fetch + decode one stem. Safe to call repeatedly (dedupes, no-op when loaded). */
  loadStem(name, url) {
    const s = this.stems.get(name);
    if (!s) return Promise.reject(new Error('Unknown part: ' + name));
    if (s.buffer) return Promise.resolve(s);
    if (s.promise) return s.promise;
    s.status = 'loading';
    s.error = null;
    this._emit('stemstatus', { name });
    s.promise = (async () => {
      try {
        let res;
        try {
          res = await fetch(url, { signal: this._abort.signal });
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          throw new Error("couldn't reach Stem Player — is it still running?");
        }
        if (!res.ok) throw new Error(res.status === 404 ? 'the file is missing' : `server error ${res.status}`);
        const data = await res.arrayBuffer();
        if (this._disposed) return s;
        let buffer;
        try {
          buffer = await this.ctx.decodeAudioData(data);
        } catch {
          throw new Error('the audio could not be decoded (out of memory?)');
        }
        if (this._disposed) return s;
        s.buffer = buffer;
        s.status = 'ready';
        this.duration = Math.max(this.duration, buffer.duration);
        this._join(s);
        this._emit('stemstatus', { name });
        return s;
      } catch (err) {
        if (this._disposed || (err && err.name === 'AbortError')) return s;
        s.status = 'error';
        s.error = (err && err.message) || 'unknown error';
        this._emit('stemstatus', { name });
        throw err;
      } finally {
        s.promise = null;
      }
    })();
    return s.promise;
  }

  /** Load several stems, at most `concurrency` at a time. Never rejects. */
  async loadMany(names, urlFor, { concurrency = 2, onProgress } = {}) {
    const queue = names.slice();
    const total = names.length;
    let done = 0;
    let failed = 0;
    if (onProgress) onProgress(done, total, failed);
    const worker = async () => {
      while (queue.length && !this._disposed) {
        const name = queue.shift();
        try {
          await this.loadStem(name, urlFor(name));
        } catch {
          failed++;
        }
        done++;
        if (!this._disposed && onProgress) onProgress(done, total, failed);
      }
    };
    const n = Math.max(1, Math.min(concurrency, total));
    await Promise.all(Array.from({ length: n }, worker));
    return { total, failed };
  }

  // ---------------------------------------------------------------- mixer

  anySolo() {
    for (const s of this.stems.values()) if (s.enabled && s.soloed) return true;
    return false;
  }

  /** Solo logic: if any (visible) stem is soloed only soloed stems play; mute wins over solo. */
  isAudible(name) {
    const s = typeof name === 'string' ? this.stems.get(name) : name;
    if (!s || !s.enabled || s.muted) return false;
    return this.anySolo() ? s.soloed : true;
  }

  _target(s) {
    return this.isAudible(s) ? s.volume : 0;
  }

  _applyGain(s) {
    const g = s.gain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this._target(s), now, GAIN_TC);
  }

  _applyGains() {
    for (const s of this.stems.values()) this._applyGain(s);
  }

  setVolume(name, v) {
    const s = this.stems.get(name);
    if (!s) return;
    s.volume = clamp(Number(v) || 0, 0, 2);
    this._applyGain(s);
  }

  setMuted(name, on) {
    const s = this.stems.get(name);
    if (!s) return;
    s.muted = !!on;
    this._applyGains();
  }

  setSoloed(name, on) {
    const s = this.stems.get(name);
    if (!s) return;
    s.soloed = !!on;
    this._applyGains();
  }

  /** Disabled stems (hidden "empty parts") are silent and don't count for solo. */
  setEnabled(name, on) {
    const s = this.stems.get(name);
    if (!s) return;
    s.enabled = !!on;
    this._applyGains();
  }

  setMasterVolume(v) {
    this.masterVolume = clamp(Number(v) || 0, 0, 1);
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.masterVolume, now, GAIN_TC);
  }

  // ---------------------------------------------------------------- transport

  /** Current song position in seconds. */
  get position() {
    if (!this.playing) return this._offset;
    const d = this.duration;
    let p = this._offset + Math.max(0, this.ctx.currentTime - this._t0);
    if (this.loop && d > 0) p %= d;
    return Math.min(p, d);
  }

  play() {
    if (this._disposed || this.playing || !this.isReady) return false;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    let off = this._offset;
    if (off >= this.duration - 0.01) off = 0;
    this.playing = true;
    this._startAll(off);
    this._emit('statechange');
    return true;
  }

  pause() {
    if (!this.playing) return;
    const p = this.position;
    this.playing = false;
    this._gen++;
    this._stopAll(true);
    this._offset = p;
    this._emit('statechange');
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t) {
    if (this._disposed) return;
    const d = this.duration;
    t = clamp(Number(t) || 0, 0, d > 0 ? d : 0);
    if (this.playing) {
      this._gen++;
      this._stopAll(true);
      this._startAll(t);
    } else {
      this._offset = t;
    }
    this._emit('seek');
  }

  setLoop(on) {
    on = !!on;
    if (on === this.loop) return;
    if (this.playing) {
      // Re-anchor the clock at "now" so position stays continuous; the running
      // sources keep playing and simply start (or stop) wrapping at the end.
      const now = this.ctx.currentTime;
      if (now >= this._t0) {
        this._offset = this.position;
        this._t0 = now;
      }
    }
    this.loop = on;
    for (const s of this.stems.values()) if (s.source) s.source.loop = on;
    this._emit('loopchange');
  }

  _startAll(offset) {
    const t0 = this.ctx.currentTime + LEAD;
    this._gen++;
    this._t0 = t0;
    this._offset = offset;
    for (const s of this.stems.values()) {
      if (s.buffer) this._startSource(s, t0, offset, this._gen);
    }
  }

  _startSource(s, when, offset, gen) {
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.loop = this.loop; // loops the whole buffer; all stems have the same length
    src.connect(s.gain);
    const g = s.gain.gain;
    g.cancelScheduledValues(when);
    g.setValueAtTime(0, when);
    g.setTargetAtTime(this._target(s), when, FADE_TC);
    src.onended = () => this._onSourceEnded(s, src, gen);
    s.source = src;
    src.start(when, Math.min(Math.max(0, offset), s.buffer.duration));
  }

  /** A stem that finished loading while playing joins in, in sync with the others. */
  _join(s) {
    if (!this.playing || !s.buffer || s.source) return;
    let when = this.ctx.currentTime + LEAD;
    let off;
    if (when <= this._t0) {
      when = this._t0;
      off = this._offset;
    } else {
      off = this._offset + (when - this._t0);
      if (this.loop && this.duration > 0) off %= this.duration;
      else if (off >= s.buffer.duration) return;
    }
    this._startSource(s, when, off, this._gen);
  }

  _stopAll(fade) {
    const now = this.ctx.currentTime;
    for (const s of this.stems.values()) this._stopSource(s, now, fade);
  }

  _stopSource(s, now, fade) {
    const src = s.source;
    if (!src) return;
    s.source = null;
    src.onended = null;
    const g = s.gain.gain;
    const smooth = fade && this.ctx.state === 'running';
    try {
      if (smooth) {
        g.cancelScheduledValues(now);
        g.setTargetAtTime(0, now, FADE_TC);
        src.stop(now + STOP_AFTER);
      } else {
        src.stop();
      }
    } catch {
      /* already stopped */
    }
    const disconnect = () => {
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    };
    if (smooth) setTimeout(disconnect, 250);
    else disconnect();
  }

  _onSourceEnded(s, src, gen) {
    if (s.source === src) s.source = null;
    try {
      src.disconnect();
    } catch {
      /* ignore */
    }
    if (gen !== this._gen || !this.playing || this._disposed) return;
    for (const other of this.stems.values()) if (other.source) return; // others still playing
    if (this.loop) return;
    // The song reached its end: stop and rewind.
    this.playing = false;
    this._gen++;
    this._offset = 0;
    this._emit('ended');
    this._emit('statechange');
  }

  // ---------------------------------------------------------------- lifecycle

  /** Stop everything and release the decoded audio (can be hundreds of MB). */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.playing = false;
    this._gen++;
    this._abort.abort();
    for (const s of this.stems.values()) {
      this._stopSource(s, this.ctx.currentTime, false);
      try {
        s.gain.disconnect();
      } catch {
        /* ignore */
      }
      s.buffer = null;
    }
    this.stems.clear();
    try {
      this.master.disconnect();
    } catch {
      /* ignore */
    }
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

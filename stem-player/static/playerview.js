// Player screen: title, transport, one mixer row per part (waveform, mute/solo,
// volume, download), "show empty parts", and the "Download mix" dialog.

import { api } from './api.js';
import { StemEngine } from './player.js';
import { Waveform } from './waveform.js';
import { el, ICONS, clamp, formatTime, formatBytes, formatGain, sortStems, stemColor, stemLabel, store } from './util.js';

const SKIP_SECONDS = 5;
const LONG_SONG_SECONDS = 10 * 60;
const MAX_KEYS = 6;

function iconButton({ icon, label, cls = '', text = '', ...rest }) {
  return el('button', {
    type: 'button',
    class: `btn ${cls}`.trim(),
    'aria-label': text ? null : label,
    title: label,
    html: icon + (text ? `<span>${text}</span>` : ''),
    ...rest,
  });
}

export class PlayerView {
  constructor(root, { toast, confirm, onBack }) {
    this.root = root;
    this.toast = toast;
    this.confirm = confirm;
    this.onBack = onBack;
    this.destroyed = false;
    this.engine = null;
    this.song = null;
    this.stems = []; // [{ name, label, detected, color }]
    this.rows = new Map(); // name -> row refs
    this.ready = false;
    this.showEmpty = false;
    this.scrubPos = null; // seconds while dragging the seek bar / a waveform
    this.raf = 0;
    this._lastTimeText = '';
    this._tick = this._tick.bind(this);
  }

  // ---------------------------------------------------------------- open / close

  async open(id) {
    this.id = id;
    this._renderLoadingShell();
    let song;
    try {
      song = await api.getSong(id);
    } catch (err) {
      if (this.destroyed) return;
      this._renderProblem(err.status === 404 ? "This song isn't in your library any more." : err.message);
      return;
    }
    if (this.destroyed) return;
    if (song.status !== 'done') {
      const why = {
        queued: 'This song is still waiting to be split.',
        processing: 'This song is still being split — it will open once it is ready.',
        error: "This song couldn't be split. You can retry it from the library.",
        cancelled: 'Splitting this song was cancelled. You can retry it from the library.',
      }[song.status] || 'This song is not ready yet.';
      this._renderProblem(why, song.title);
      return;
    }
    this.song = song;
    document.title = `${song.title} — Stem Player`;
    try {
      this.engine = new StemEngine();
    } catch (err) {
      this._renderProblem(err.message, song.title);
      return;
    }
    this._setupStems();
    this._renderPlayer();
    this._wireEngine();
    this._loadPeaks();
    this._loadStems(this.stems.filter((s) => s.detected).map((s) => s.name), true);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    // Save a title that was being edited when the user navigated away.
    if (this.$title && this.song) {
      const v = this.$title.value.trim();
      if (v && v !== this.song.title) api.renameSong(this.id, v).catch(() => {});
    }
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.engine) {
      this.engine.dispose(); // stops all sources and drops the decoded buffers
      this.engine = null;
    }
    for (const row of this.rows.values()) row.wave.destroy();
    this.rows.clear();
    if (this.$mix && this.$mix.open) this.$mix.close();
    this.root.replaceChildren();
  }

  _backButton() {
    return iconButton({ icon: ICONS.back, label: 'Back to your songs', text: 'Library', cls: 'btn-ghost btn-back', onclick: () => this.onBack() });
  }

  _renderLoadingShell() {
    this.root.replaceChildren(
      el('div', { class: 'player' },
        el('header', { class: 'player-header' }, this._backButton()),
        el('div', { class: 'player-message' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('p', {}, 'Opening song…')),
      ),
    );
  }

  _renderProblem(message, title) {
    document.title = 'Stem Player';
    this.root.replaceChildren(
      el('div', { class: 'player' },
        el('header', { class: 'player-header' }, this._backButton()),
        el('div', { class: 'player-message', role: 'alert' },
          title ? el('h1', { class: 'player-message-title' }, title) : null,
          el('p', {}, message),
          el('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.onBack() }, 'Back to your songs'),
        ),
      ),
    );
  }

  _setupStems() {
    const sorted = sortStems(this.song.stems || []);
    this.stems = sorted.map((s, i) => ({
      name: s.name,
      label: stemLabel(s),
      detected: s.detected !== false,
      color: stemColor(s.name, i),
    }));
    // Never show an empty player: if nothing was "detected", show everything.
    if (!this.stems.some((s) => s.detected)) for (const s of this.stems) s.detected = true;
    for (const s of this.stems) this.engine.addStem(s.name, { enabled: s.detected });
    this.engine.setMasterVolume(clamp(Number(store.get('masterVolume', 1)), 0, 1));
  }

  _duration() {
    return (this.engine && this.engine.duration) || Number(this.song && this.song.duration) || 0;
  }

  // ---------------------------------------------------------------- DOM

  _renderPlayer() {
    const song = this.song;
    const detected = this.stems.filter((s) => s.detected);
    const empty = this.stems.filter((s) => !s.detected);
    const dur = this._duration();

    // Header: back, editable title, download mix
    this.$title = el('input', {
      type: 'text',
      class: 'title-input',
      value: song.title,
      maxlength: '200',
      spellcheck: 'false',
      autocomplete: 'off',
      'aria-label': 'Song title (type to rename)',
      title: 'Click to rename',
    });
    this.$title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.$title.blur();
      } else if (e.key === 'Escape') {
        this.$title.value = this.song.title;
        this.$title.blur();
      }
    });
    this.$title.addEventListener('blur', () => this._commitTitle());

    let found = `${detected.length} ${detected.length === 1 ? 'part' : 'parts'} found`;
    if (empty.length) found += ` (${empty.length} empty)`;
    const metaBits = [found];
    if (dur) metaBits.push(formatTime(dur));
    if (song.quality === 'high') metaBits.push('high quality');
    if (song.original_filename) metaBits.push(`from “${song.original_filename}”`);
    const meta = el('p', { class: 'player-meta' }, metaBits.join(' · '));

    const mixBtn = iconButton({ icon: ICONS.download, label: 'Download a custom mix of the parts', text: 'Download mix', cls: 'btn-secondary', onclick: () => this._openMix() });

    const header = el('header', { class: 'player-header' },
      this._backButton(),
      el('div', { class: 'title-wrap' }, this.$title, meta),
      mixBtn,
    );

    // Loading / error notice
    this.$noticeText = el('span', { class: 'notice-text' });
    this.$noticeBar = el('div', { class: 'progress-bar' });
    this.$noticeProgress = el('div', { class: 'progress' }, this.$noticeBar);
    this.$noticeAction = el('span', { class: 'notice-action' });
    this.$notice = el('div', { class: 'notice', role: 'status', hidden: true },
      el('span', { class: 'spinner', 'aria-hidden': 'true' }), this.$noticeText, this.$noticeProgress, this.$noticeAction);

    // Memory note for long songs
    let memNote = null;
    if (dur > LONG_SONG_SECONDS) {
      const bytes = detected.length * dur * 44100 * 2 * 4;
      memNote = el('p', { class: 'memory-note' },
        `This is a long song (${formatTime(dur)}). Playing it needs about ${formatBytes(bytes)} of memory in your browser — if things get slow, close other tabs.`);
    }

    // Transport
    this.$toStart = iconButton({ icon: ICONS.toStart, label: 'Back to start (Home)', cls: 'btn-round', onclick: () => this._seekTo(0) });
    this.$play = el('button', { type: 'button', class: 'play-btn', 'aria-label': 'Play (Space)', title: 'Play (Space)', html: ICONS.play, onclick: () => this._togglePlay() });
    this.$cur = el('span', { class: 'time-cur' }, '00:00');
    this.$total = el('span', { class: 'time-total' }, formatTime(dur));
    this.$seek = el('input', {
      type: 'range',
      class: 'range seek',
      min: '0',
      max: String(Math.max(1, Math.ceil(dur))),
      step: '1',
      value: '0',
      'aria-label': 'Position in song',
    });
    this.$seek.addEventListener('input', () => {
      this.scrubPos = Number(this.$seek.value);
      this._renderPosition();
    });
    const commitSeek = () => {
      if (this.scrubPos === null) return;
      const t = this.scrubPos;
      this.scrubPos = null;
      this._seekTo(t);
    };
    this.$seek.addEventListener('change', commitSeek);
    this.$seek.addEventListener('pointerup', () => setTimeout(commitSeek, 0));
    this.$seek.addEventListener('blur', commitSeek);

    this.$loop = iconButton({ icon: ICONS.loop, label: 'Loop the song', cls: 'btn-round btn-toggle', 'aria-pressed': 'false', onclick: () => this._toggleLoop() });

    const mv = Math.round(this.engine.masterVolume * 100);
    this.$master = el('input', { type: 'range', class: 'range master-range', min: '0', max: '100', step: '1', value: String(mv), 'aria-label': 'Master volume' });
    this.$masterOut = el('output', { class: 'vol-out' }, `${mv}%`);
    this.$master.addEventListener('input', () => {
      const v = Number(this.$master.value);
      this.engine.setMasterVolume(v / 100);
      store.set('masterVolume', v / 100);
      this._renderMaster();
    });

    const transport = el('section', { class: 'transport', 'aria-label': 'Playback' },
      el('div', { class: 'transport-buttons' }, this.$toStart, this.$play, this.$loop),
      el('div', { class: 'time', 'aria-hidden': 'true' }, this.$cur, el('span', { class: 'time-sep' }, '/'), this.$total),
      el('div', { class: 'seek-wrap' }, this.$seek),
      el('div', { class: 'master' }, el('span', { class: 'master-icon', 'aria-hidden': 'true', html: ICONS.volume }), this.$master, this.$masterOut),
    );

    // Mixer rows
    this.$rows = el('section', { class: 'stems', 'aria-label': 'Parts' }, detected.map((s) => this._buildRow(s)));
    this.$emptyRows = el('section', { class: 'stems stems-empty', id: 'empty-stems', 'aria-label': 'Empty parts', hidden: true }, empty.map((s) => this._buildRow(s)));
    let emptyToggle = null;
    if (empty.length) {
      this.$emptyToggle = el('button', {
        type: 'button',
        class: 'btn btn-ghost empty-toggle',
        'aria-expanded': 'false',
        'aria-controls': 'empty-stems',
        onclick: () => this._toggleEmpty(),
      });
      emptyToggle = el('div', { class: 'empty-toggle-wrap' }, this.$emptyToggle,
        el('span', { class: 'muted empty-hint' }, 'Parts that are (almost) silent in this song.'));
    }

    const shortcuts = el('p', { class: 'shortcuts' },
      el('kbd', {}, 'Space'), ' play/pause  ·  ', el('kbd', {}, '←'), ' ', el('kbd', {}, '→'), ' skip 5 s  ·  ',
      el('kbd', {}, 'Home'), ' back to start  ·  ', el('kbd', {}, '1'), '–', el('kbd', {}, '6'), ' mute  ·  ',
      el('kbd', {}, 'Shift'), '+', el('kbd', {}, '1'), '–', el('kbd', {}, '6'), ' solo  ·  double-click a volume slider to reset it');

    this.root.replaceChildren(
      el('div', { class: 'player' }, header, this.$notice, memNote, transport, this.$rows, emptyToggle, this.$emptyRows, shortcuts),
    );

    this._renderEmptyToggle();
    this._renderKeyHints();
    this._renderMixer();
    this._renderMaster();
    this._renderTransport();
    this._renderPosition();
  }

  _buildRow(s) {
    const r = { name: s.name };
    r.key = el('kbd', { class: 'key-hint', 'aria-hidden': 'true' });
    r.status = el('span', { class: 'stem-status' });
    r.mute = el('button', { type: 'button', class: 'ms-btn ms-mute', 'aria-pressed': 'false', 'aria-label': `Mute ${s.label}`, onclick: () => this._toggleMute(s.name) }, 'M');
    r.solo = el('button', { type: 'button', class: 'ms-btn ms-solo', 'aria-pressed': 'false', 'aria-label': `Solo ${s.label}`, onclick: () => this._toggleSolo(s.name) }, 'S');
    r.vol = el('input', { type: 'range', class: 'range stem-vol', min: '0', max: '200', step: '1', value: '100', 'aria-label': `${s.label} volume`, title: 'Double-click to reset to 100%' });
    r.volOut = el('output', { class: 'vol-out' }, '100%');
    r.vol.addEventListener('input', () => this._setVolume(s.name, Number(r.vol.value) / 100));
    r.vol.addEventListener('dblclick', () => this._setVolume(s.name, 1));
    const dl = el('a', {
      class: 'btn btn-ghost btn-icon',
      href: api.stemUrl(this.id, s.name, { download: true }),
      download: '',
      'aria-label': `Download ${s.label} (WAV)`,
      title: `Download ${s.label} as a WAV file`,
      html: ICONS.download,
    });
    r.canvas = el('canvas', { class: 'wave', role: 'img', 'aria-label': `${s.label} waveform — click to jump to a position` });
    r.row = el('div', { class: 'stem-row', role: 'group', 'aria-label': s.label, dataset: { stem: s.name }, style: { '--stem': s.color } },
      el('div', { class: 'stem-side' },
        el('div', { class: 'stem-head' },
          el('span', { class: 'stem-dot', 'aria-hidden': 'true' }),
          el('span', { class: 'stem-name' }, s.label),
          s.detected ? null : el('span', { class: 'tag' }, 'mostly silent'),
          r.status,
          r.key,
        ),
        el('div', { class: 'stem-controls' }, r.mute, r.solo, r.vol, r.volOut, dl),
      ),
      el('div', { class: 'stem-wave' }, r.canvas),
    );
    r.wave = new Waveform(r.canvas, {
      color: s.color,
      onScrub: (f) => {
        if (!this.ready) return;
        this.scrubPos = f * this._duration();
        this._renderPosition();
      },
      onSeek: (f) => {
        if (!this.ready) return;
        this.scrubPos = null;
        this._seekTo(f * this._duration());
      },
    });
    this.rows.set(s.name, r);
    return r.row;
  }

  // ---------------------------------------------------------------- loading

  async _loadPeaks() {
    try {
      const peaks = await api.getPeaks(this.id);
      if (this.destroyed || !peaks) return;
      for (const [name, r] of this.rows) if (Array.isArray(peaks[name])) r.wave.setPeaks(peaks[name]);
    } catch {
      /* waveforms stay as flat lines; playback still works */
    }
  }

  async _loadStems(names, primary) {
    if (!this.engine || !names.length) {
      if (primary) this._setReady();
      return;
    }
    if (primary) this._showNotice(`Loading parts… 0/${names.length}`, 0);
    const { failed, total } = await this.engine.loadMany(names, (n) => api.stemUrl(this.id, n), {
      concurrency: 2,
      onProgress: (done, tot) => {
        if (primary && !this.destroyed) this._showNotice(`Loading parts… ${done}/${tot}`, tot ? done / tot : 0);
      },
    });
    if (this.destroyed || !this.engine) return;
    if (failed) {
      const missing = names.filter((n) => !this.engine.stems.get(n) || !this.engine.stems.get(n).buffer);
      const msg = failed === total && primary
        ? "Couldn't load the parts of this song."
        : `Couldn't load ${failed} ${failed === 1 ? 'part' : 'parts'}.`;
      this._showNotice(msg, null, {
        error: true,
        action: {
          label: 'Try again',
          onClick: () => {
            this._hideNotice();
            this._loadStems(missing, !this.ready);
          },
        },
      });
    } else if (primary || !this.$notice.classList.contains('is-error')) {
      this._hideNotice();
    }
    if (primary || !this.ready) this._setReady();
  }

  _setReady() {
    if (!this.engine || !this.engine.isReady) {
      this._renderTransport();
      return;
    }
    this.ready = true;
    const dur = this._duration();
    this.$seek.max = String(Math.max(1, Math.ceil(dur)));
    this.$total.textContent = formatTime(dur);
    for (const r of this.rows.values()) r.wave.setInteractive(true);
    this._renderTransport();
    this._renderPosition();
  }

  _showNotice(text, progress, { error = false, action = null } = {}) {
    this.$notice.hidden = false;
    this.$notice.classList.toggle('is-error', error);
    this.$notice.setAttribute('role', error ? 'alert' : 'status');
    this.$noticeText.textContent = text;
    this.$noticeProgress.hidden = progress === null || progress === undefined;
    if (!this.$noticeProgress.hidden) this.$noticeBar.style.width = `${Math.round(progress * 100)}%`;
    this.$noticeAction.replaceChildren(
      action ? el('button', { type: 'button', class: 'btn btn-small', onclick: action.onClick }, action.label) : '',
    );
  }

  _hideNotice() {
    this.$notice.hidden = true;
    this.$notice.classList.remove('is-error');
  }

  // ---------------------------------------------------------------- engine wiring

  _wireEngine() {
    const e = this.engine;
    e.addEventListener('statechange', () => {
      this._renderTransport();
      if (e.playing) this._startLoop();
      else this._renderPosition();
    });
    e.addEventListener('ended', () => this._renderPosition());
    e.addEventListener('loopchange', () => this._renderTransport());
    e.addEventListener('seek', () => this._renderPosition());
    e.addEventListener('stemstatus', (ev) => this._renderStemStatus(ev.detail && ev.detail.name));
  }

  _startLoop() {
    if (!this.raf) this.raf = requestAnimationFrame(this._tick);
  }

  _tick() {
    this.raf = 0;
    if (this.destroyed || !this.engine) return;
    this._renderPosition();
    if (this.engine.playing) this.raf = requestAnimationFrame(this._tick);
  }

  // ---------------------------------------------------------------- actions

  _togglePlay() {
    if (!this.ready || !this.engine) return;
    this.engine.toggle();
  }

  _seekTo(t) {
    if (!this.ready || !this.engine) return;
    this.engine.seek(clamp(t, 0, this._duration()));
    this._renderPosition();
  }

  _skip(delta) {
    if (!this.ready || !this.engine) return;
    this._seekTo(this.engine.position + delta);
  }

  _toggleLoop() {
    if (!this.engine) return;
    this.engine.setLoop(!this.engine.loop);
  }

  _toggleMute(name) {
    const s = this.engine && this.engine.stems.get(name);
    if (!s) return;
    this.engine.setMuted(name, !s.muted);
    this._renderMixer();
  }

  _toggleSolo(name) {
    const s = this.engine && this.engine.stems.get(name);
    if (!s) return;
    this.engine.setSoloed(name, !s.soloed);
    this._renderMixer();
  }

  _setVolume(name, v) {
    if (!this.engine) return;
    this.engine.setVolume(name, v);
    this._renderMixer();
  }

  _toggleEmpty() {
    this.showEmpty = !this.showEmpty;
    const empty = this.stems.filter((s) => !s.detected);
    for (const s of empty) this.engine.setEnabled(s.name, this.showEmpty);
    this.$emptyRows.hidden = !this.showEmpty;
    this._renderEmptyToggle();
    this._renderKeyHints();
    this._renderMixer();
    if (this.showEmpty) {
      // Load the empty parts only now (on demand).
      const toLoad = empty.map((s) => s.name).filter((n) => !this.engine.stems.get(n).buffer);
      if (toLoad.length) this._loadStems(toLoad, false);
    }
  }

  async _commitTitle() {
    if (!this.song || this.destroyed) return;
    const v = this.$title.value.trim();
    if (!v) {
      this.$title.value = this.song.title;
      return;
    }
    if (v === this.song.title) return;
    try {
      const song = await api.renameSong(this.id, v);
      if (this.destroyed) return;
      this.song = { ...this.song, title: song.title };
      if (document.activeElement !== this.$title) this.$title.value = song.title;
      document.title = `${song.title} — Stem Player`;
      this.toast('Renamed.', { type: 'success', timeout: 2500 });
    } catch (err) {
      if (this.destroyed) return;
      this.$title.value = this.song.title;
      this.toast(`Couldn't rename: ${err.message}`, { type: 'error' });
    }
  }

  // ---------------------------------------------------------------- keyboard

  /** Returns true when the key was handled (caller prevents default). */
  handleKey(e) {
    if (!this.engine) return false;
    const t = e.target;
    const onRange = t instanceof HTMLInputElement && t.type === 'range';
    if (e.code === 'Space' || e.key === ' ') {
      if (!e.repeat) this._togglePlay();
      return true;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (onRange || e.shiftKey) return false;
      this._skip(e.key === 'ArrowLeft' ? -SKIP_SECONDS : SKIP_SECONDS);
      return true;
    }
    if (e.key === 'Home') {
      if (onRange) return false;
      this._seekTo(0);
      return true;
    }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
    if (m) {
      const n = Number(m[1]);
      if (n > MAX_KEYS) return false;
      if (e.repeat) return true;
      const s = this._visibleStems()[n - 1];
      if (!s) return true;
      if (e.shiftKey) this._toggleSolo(s.name);
      else this._toggleMute(s.name);
      return true;
    }
    return false;
  }

  /** Rows in on-screen order: found parts first, then (if shown) the empty ones. */
  _visibleStems() {
    const found = this.stems.filter((s) => s.detected);
    return this.showEmpty ? found.concat(this.stems.filter((s) => !s.detected)) : found;
  }

  // ---------------------------------------------------------------- rendering

  _renderTransport() {
    const playing = !!(this.engine && this.engine.playing);
    const disabled = !this.ready;
    this.$play.disabled = disabled;
    this.$toStart.disabled = disabled;
    this.$seek.disabled = disabled;
    this.$play.innerHTML = playing ? ICONS.pause : ICONS.play;
    const label = playing ? 'Pause (Space)' : 'Play (Space)';
    this.$play.setAttribute('aria-label', label);
    this.$play.title = label;
    this.$play.classList.toggle('is-playing', playing);
    const loop = !!(this.engine && this.engine.loop);
    this.$loop.setAttribute('aria-pressed', String(loop));
    this.root.querySelector('.player').classList.toggle('is-loading', disabled);
  }

  _renderPosition() {
    if (!this.engine) return;
    const dur = this._duration();
    const pos = this.scrubPos !== null ? this.scrubPos : this.engine.position;
    const text = formatTime(pos);
    if (text !== this._lastTimeText) {
      this._lastTimeText = text;
      this.$cur.textContent = text;
      this.$seek.setAttribute('aria-valuetext', `${text} of ${formatTime(dur)}`);
    }
    if (this.scrubPos === null) this.$seek.value = String(Math.floor(pos));
    const f = dur > 0 ? clamp(pos / dur, 0, 1) : 0;
    this.$seek.style.setProperty('--pct', `${(f * 100).toFixed(3)}%`);
    for (const r of this.rows.values()) r.wave.setProgress(f);
  }

  _renderMaster() {
    const v = Number(this.$master.value);
    this.$masterOut.textContent = `${v}%`;
    this.$master.setAttribute('aria-valuetext', `${v}%`);
    this.$master.style.setProperty('--pct', `${v}%`);
  }

  _renderMixer() {
    if (!this.engine) return;
    for (const [name, r] of this.rows) {
      const s = this.engine.stems.get(name);
      if (!s) continue;
      r.mute.setAttribute('aria-pressed', String(s.muted));
      r.solo.setAttribute('aria-pressed', String(s.soloed));
      const pct = Math.round(s.volume * 100);
      if (Number(r.vol.value) !== pct) r.vol.value = String(pct);
      r.volOut.textContent = `${pct}%`;
      r.vol.setAttribute('aria-valuetext', `${pct}%`);
      r.vol.style.setProperty('--pct', `${pct / 2}%`);
      r.row.classList.toggle('is-silent', !this.engine.isAudible(name));
      r.row.classList.toggle('is-muted', s.muted);
      r.row.classList.toggle('is-soloed', s.soloed);
    }
  }

  _renderStemStatus(name) {
    const r = this.rows.get(name);
    const s = this.engine && this.engine.stems.get(name);
    if (!r || !s) return;
    r.row.classList.toggle('is-loading', s.status === 'loading');
    r.row.classList.toggle('is-error', s.status === 'error');
    if (s.status === 'loading') {
      r.status.replaceChildren(el('span', { class: 'spinner spinner-small', 'aria-hidden': 'true' }), 'Loading…');
      r.status.title = '';
    } else if (s.status === 'error') {
      r.status.textContent = "Couldn't load";
      r.status.title = s.error || '';
    } else {
      r.status.textContent = '';
      r.status.title = '';
    }
  }

  _renderEmptyToggle() {
    if (!this.$emptyToggle) return;
    const n = this.stems.filter((s) => !s.detected).length;
    this.$emptyToggle.textContent = this.showEmpty ? `Hide ${n === 1 ? 'empty part' : 'empty parts'}` : `Show ${n} empty ${n === 1 ? 'part' : 'parts'}`;
    this.$emptyToggle.setAttribute('aria-expanded', String(this.showEmpty));
  }

  _renderKeyHints() {
    const visible = this._visibleStems();
    for (const [name, r] of this.rows) {
      const i = visible.findIndex((s) => s.name === name);
      const label = this.stems.find((s) => s.name === name).label;
      if (i !== -1 && i < MAX_KEYS) {
        r.key.textContent = String(i + 1);
        r.key.hidden = false;
        r.key.title = `Press ${i + 1} to mute, Shift+${i + 1} to solo`;
        r.mute.title = `Mute ${label} (${i + 1})`;
        r.solo.title = `Solo ${label} (Shift+${i + 1})`;
      } else {
        r.key.hidden = true;
        r.mute.title = `Mute ${label}`;
        r.solo.title = `Solo ${label}`;
      }
    }
  }

  // ---------------------------------------------------------------- download mix

  _openMix() {
    if (!this.engine) return;
    if (this.$mix) this.$mix.remove();
    const engine = this.engine;
    const items = [];
    const list = el('ul', { class: 'mix-list' });
    for (const s of this.stems) {
      const st = engine.stems.get(s.name);
      const audible = engine.isAudible(s.name);
      const cb = el('input', { type: 'checkbox', value: s.name });
      cb.checked = audible && st.volume > 0;
      let note = '';
      if (!s.detected) note = 'empty';
      else if (st.muted) note = 'muted';
      else if (!audible) note = 'not soloed';
      const gainPct = Math.round(st.volume * 100);
      items.push({ name: s.name, cb, gain: st.volume });
      list.append(
        el('li', { style: { '--stem': s.color } },
          el('label', { class: 'mix-item' },
            cb,
            el('span', { class: 'stem-dot', 'aria-hidden': 'true' }),
            el('span', { class: 'mix-name' }, s.label),
            note ? el('span', { class: 'tag' }, note) : null,
            el('span', { class: 'mix-gain', title: 'Level from the mixer' }, `${gainPct}%`),
          ),
        ),
      );
    }

    const savedFmt = store.get('mixFormat', 'wav') === 'mp3' ? 'mp3' : 'wav';
    const radio = (value, label, hint) => {
      const input = el('input', { type: 'radio', name: 'mix-format', value });
      input.checked = value === savedFmt;
      return el('label', { class: 'format-option' }, input, el('span', { class: 'format-text' }, el('strong', {}, label), el('small', {}, hint)));
    };

    const summary = el('p', { class: 'mix-summary', 'aria-live': 'polite' });
    const go = el('button', { type: 'submit', value: 'download', class: 'btn btn-primary', html: ICONS.download + '<span>Download mix</span>' });
    const update = () => {
      const chosen = items.filter((i) => i.cb.checked);
      const audible = chosen.filter((i) => i.gain > 0);
      if (!chosen.length) summary.textContent = 'Tick at least one part.';
      else if (!audible.length) summary.textContent = 'All ticked parts are at 0% volume — turn one up in the mixer first.';
      else summary.textContent = `${chosen.length} ${chosen.length === 1 ? 'part' : 'parts'} at the levels shown.`;
      go.disabled = !audible.length;
    };

    const form = el('form', { method: 'dialog', class: 'dialog-body' },
      el('div', { class: 'dialog-head' },
        el('h2', { id: 'mix-title', class: 'dialog-title' }, 'Download a custom mix'),
        el('button', { type: 'submit', value: 'cancel', class: 'btn btn-ghost btn-icon', 'aria-label': 'Close', html: ICONS.close }),
      ),
      el('p', { class: 'dialog-text' }, 'Ticked: the parts you are hearing right now, at their current levels.'),
      list,
      el('fieldset', { class: 'format' },
        el('legend', {}, 'Format'),
        radio('wav', 'WAV', 'Best quality, bigger file'),
        radio('mp3', 'MP3', '320 kbps, smaller file'),
      ),
      summary,
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'submit', value: 'cancel', class: 'btn btn-ghost' }, 'Cancel'),
        go,
      ),
    );
    form.addEventListener('change', update);
    const dialog = el('dialog', { class: 'dialog mix-dialog', 'aria-labelledby': 'mix-title' }, form);
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'download') {
        const fmtInput = form.querySelector('input[name="mix-format"]:checked');
        const format = fmtInput ? fmtInput.value : 'wav';
        store.set('mixFormat', format);
        const parts = items.filter((i) => i.cb.checked).map((i) => ({ name: i.name, gain: formatGain(i.gain) }));
        this._downloadMix(api.mixUrl(this.id, parts, format), format);
      }
      dialog.remove();
      if (this.$mix === dialog) this.$mix = null;
    });
    this.$mix = dialog;
    this.root.append(dialog);
    update();
    dialog.showModal();
  }

  async _downloadMix(url, format) {
    // Make sure the server is there first, so a dead server gives a friendly message
    // instead of a failed download in the browser's download list.
    try {
      await api.health();
    } catch (err) {
      this.toast(err.message, { type: 'error' });
      return;
    }
    this._download(url);
    this.toast(
      format === 'mp3'
        ? 'Making your MP3 mix — the download starts in a few seconds.'
        : 'Making your mix — the download starts in a moment.',
      { type: 'success' },
    );
  }

  _download(url) {
    const a = el('a', { href: url, download: '', hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
  }
}

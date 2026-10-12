// Library screen: upload (picker / drop), model + quality choice, song list with
// live status while songs are being split (polls every 1 s only while needed).

import { api } from './api.js';
import { el, ICONS, formatTime, formatBytes, store, sortStems, stemColor, stemLabel } from './util.js';

const MAX_UPLOAD = 500 * 1024 * 1024;
const POLL_MS = 1000;
const POLL_OFFLINE_MS = 3000;

export const DEFAULT_MODEL = 'htdemucs_6s';

// Labels shown in the "Split into" menu (server ids from /api/health).
const MODEL_LABELS = {
  htdemucs_6s: '6 parts — vocals, drums, bass, guitar, piano, other (recommended)',
  htdemucs_ft: '4 parts — best quality (slower)',
  htdemucs: '4 parts — fast',
};
const MODEL_SHORT = {
  htdemucs_6s: '6 parts',
  htdemucs_ft: '4 parts · best quality',
  htdemucs: '4 parts · fast',
};

const MEDIA_EXTENSIONS = new Set([
  'mp3', 'wav', 'wave', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aif', 'aiff', 'aifc',
  'alac', 'mka', 'ac3', 'eac3', 'dts', 'amr', 'caf', 'wv', 'ape', 'mp2', 'mpc', 'spx', 'au', 'snd',
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', 'm2ts', 'mts', '3gp', '3g2', 'ogv',
]);

const STATUS_TEXT = {
  queued: 'Waiting',
  processing: 'Splitting',
  done: 'Ready',
  error: 'Failed',
  cancelled: 'Cancelled',
};

const isActive = (s) => s && (s.status === 'queued' || s.status === 'processing');

function fileKey(f) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function fraction(p) {
  let v = Number(p) || 0;
  if (v > 1) v /= 100; // tolerate 0..100
  return Math.min(1, Math.max(0, v));
}

export function stageText(song) {
  const pct = Math.round(fraction(song.progress) * 100);
  switch (song.status) {
    case 'queued':
      return 'Waiting for its turn…';
    case 'processing':
      switch (song.stage) {
        case 'loading_model':
          return 'Loading model (first time downloads ~80 MB)…';
        case 'decoding':
          return 'Reading file…';
        case 'separating':
          return `Separating… ${pct}%`;
        case 'saving':
          return 'Saving…';
        case 'queued':
          return 'Starting…';
        default:
          return 'Working…';
      }
    case 'done': {
      const stems = Array.isArray(song.stems) ? song.stems : [];
      const found = stems.filter((s) => s.detected !== false).length;
      const empty = stems.length - found;
      let t = `${found} ${found === 1 ? 'part' : 'parts'} found`;
      if (empty > 0) t += ` · ${empty} empty`;
      return t;
    }
    case 'error':
      return song.error ? String(song.error) : 'Something went wrong while splitting this song.';
    case 'cancelled':
      return 'Cancelled — press Retry to split it again.';
    default:
      return '';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function modelShort(id) {
  return MODEL_SHORT[id] || id || '';
}

export class LibraryView {
  constructor(root, { toast, confirm, onOpen }) {
    this.root = root;
    this.toast = toast;
    this.confirm = confirm;
    this.onOpen = onOpen;
    this.songs = new Map(); // id -> meta
    this.order = []; // ids, newest first
    this.cards = new Map(); // id -> { li, refs }
    this.visible = false;
    this.loadedOnce = false;
    this.uploadQueue = []; // { file, key, model, quality, row }
    this.currentUpload = null;
    this._pollTimer = null;
    this._offline = false;
    this.health = null;
  }

  // ---------------------------------------------------------------- setup

  init() {
    const $ = (s) => this.root.querySelector(s);
    this.$list = $('#song-list');
    this.$empty = $('#library-empty');
    this.$loading = $('#library-loading');
    this.$count = $('#song-count');
    this.$uploads = $('#upload-list');
    this.$model = $('#model-select');
    this.$quality = $('#quality-select');
    this.$modelNote = $('#model-note');
    this.$deviceNote = $('#device-note');
    this.$pills = $('#health-pills');
    this.$fileInput = $('#file-input');
    this.$choose = $('#choose-btn');

    this.root.querySelector('.dropzone-icon').innerHTML = ICONS.upload;
    document.querySelector('#drop-overlay .dropzone-icon').innerHTML = ICONS.upload;

    this._renderModelOptions(null);
    const savedQuality = store.get('quality', 'normal');
    this.$quality.value = savedQuality === 'high' ? 'high' : 'normal';

    this.$model.addEventListener('change', () => {
      store.set('model', this.$model.value);
      this._renderModelNote();
    });
    this.$quality.addEventListener('change', () => store.set('quality', this.$quality.value));

    this.$choose.addEventListener('click', () => this.$fileInput.click());
    this.$fileInput.addEventListener('change', () => {
      const files = Array.from(this.$fileInput.files || []);
      this.$fileInput.value = ''; // allow choosing the same file again later
      if (files.length) this.addFiles(files);
    });

    // Highlight the drop zone itself while dragging over it (the whole window accepts drops).
    const dz = $('#dropzone');
    dz.addEventListener('dragenter', () => dz.classList.add('is-over'));
    dz.addEventListener('dragleave', (e) => {
      if (!dz.contains(e.relatedTarget)) dz.classList.remove('is-over');
    });
    window.addEventListener('drop', () => dz.classList.remove('is-over'));

    this._loadHealth();
  }

  async _loadHealth() {
    try {
      this.health = await api.health();
    } catch {
      this.health = null;
      // Try again a bit later (server may still be starting).
      setTimeout(() => {
        if (!this.health) this._loadHealth();
      }, 3000);
      return;
    }
    this._renderModelOptions(this.health && this.health.models);
    this._renderHealth();
    // Right after start-up the splitting engine (PyTorch) is still loading and the
    // device isn't known yet: ask again shortly so the CPU / graphics-card note appears.
    if (this.health && this.health.separator_status === 'loading') {
      setTimeout(() => this._loadHealth(), 2000);
    }
  }

  _renderModelOptions(models) {
    const sel = this.$model;
    let list;
    if (Array.isArray(models) && models.length) {
      const known = Object.keys(MODEL_LABELS);
      list = models
        .filter((m) => m && m.id)
        .sort((a, b) => {
          const ia = known.indexOf(a.id);
          const ib = known.indexOf(b.id);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map((m) => ({ id: m.id, label: MODEL_LABELS[m.id] || m.label || m.id, note: m.note || '' }));
    } else {
      list = Object.entries(MODEL_LABELS).map(([id, label]) => ({ id, label, note: '' }));
    }
    this.models = list;
    const wanted = sel.value || store.get('model', DEFAULT_MODEL);
    sel.replaceChildren(...list.map((m) => el('option', { value: m.id }, m.label)));
    const ids = list.map((m) => m.id);
    sel.value = ids.includes(wanted) ? wanted : ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0];
    this._renderModelNote();
  }

  _renderModelNote() {
    const m = (this.models || []).find((x) => x.id === this.$model.value);
    this.$modelNote.textContent = (m && m.note) || '';
    this.$modelNote.hidden = !this.$modelNote.textContent;
  }

  _renderHealth() {
    const h = this.health || {};
    const pills = [];
    if (h.device === 'cuda') {
      pills.push(el('span', { class: 'pill pill-good', title: 'Splitting runs on your NVIDIA graphics card' }, 'Graphics card (fast)'));
      this.$deviceNote.textContent = 'Using your NVIDIA graphics card — a 4-minute song takes about a minute.';
    } else if (h.device) {
      pills.push(el('span', { class: 'pill pill-neutral', title: 'Splitting runs on the processor' }, 'Processor (CPU)'));
      this.$deviceNote.textContent = 'Splitting runs on your processor — a 4-minute song can take several minutes. You can keep using the player meanwhile.';
    }
    if (h.separator_status === 'unavailable') {
      pills.push(el('span', { class: 'pill pill-warn', title: h.separator_error || '' }, 'Splitting engine missing'));
      this.$deviceNote.textContent = h.separator_error ||
        "The splitting engine didn't load. Close Stem Player, delete the .venv folder and run Start Stem Player.bat again.";
    }
    if (h.separator === 'fake') {
      pills.push(el('span', { class: 'pill pill-warn', title: 'STEM_PLAYER_SEPARATOR=fake: the parts are not real separations' }, 'Test mode'));
    }
    this.$pills.replaceChildren(...pills);
  }

  // ---------------------------------------------------------------- visibility & polling

  show() {
    this.visible = true;
    this.refresh();
  }

  hide() {
    this.visible = false;
    clearTimeout(this._pollTimer);
    this._pollTimer = null;
  }

  async refresh() {
    if (!this.loadedOnce) this.$loading.hidden = false;
    let songs;
    try {
      songs = await api.listSongs();
    } catch (err) {
      this.$loading.hidden = true;
      if (!err.offline) this.toast(err.message, { type: 'error' });
      if (!this.loadedOnce) this._renderList();
      return;
    }
    this.loadedOnce = true;
    this.$loading.hidden = true;
    const fresh = new Map(songs.filter((s) => s && s.id).map((s) => [s.id, s]));
    for (const [id, prev] of this.songs) {
      const next = fresh.get(id);
      if (next) this._notifyTransition(prev, next);
    }
    this.songs = fresh;
    this.order = songs.filter((s) => s && s.id).map((s) => s.id);
    this._renderList();
    this._schedulePoll();
  }

  _schedulePoll(delay = POLL_MS) {
    if (this._pollTimer || !this.visible) return;
    let any = false;
    for (const s of this.songs.values()) if (isActive(s)) any = true;
    if (!any) return;
    this._pollTimer = setTimeout(() => this._poll(), delay);
  }

  async _poll() {
    this._pollTimer = null;
    if (!this.visible) return;
    const active = [...this.songs.values()].filter(isActive);
    let offline = false;
    await Promise.all(
      active.map(async (s) => {
        try {
          const fresh = await api.getSong(s.id);
          if (!this.songs.has(s.id)) return; // deleted meanwhile
          this._notifyTransition(this.songs.get(s.id), fresh);
          this.songs.set(s.id, fresh);
          this._updateCard(fresh);
        } catch (err) {
          if (err.status === 404) {
            this._removeSong(s.id);
          } else if (err.offline) {
            offline = true;
          }
        }
      }),
    );
    this._renderCount();
    this._schedulePoll(offline ? POLL_OFFLINE_MS : POLL_MS);
  }

  _notifyTransition(prev, next) {
    if (!prev || !next || prev.status === next.status) return;
    if (next.status === 'done' && isActive(prev)) {
      this.toast(`“${next.title}” is ready.`, {
        type: 'success',
        action: { label: 'Open', onClick: () => this.onOpen(next.id) },
      });
    } else if (next.status === 'error' && isActive(prev)) {
      this.toast(`Couldn't split “${next.title}” — see the message in your song list.`, { type: 'error' });
    }
  }

  // ---------------------------------------------------------------- song list

  _renderList() {
    const frag = document.createDocumentFragment();
    const keep = new Set(this.order);
    for (const [id, card] of this.cards) {
      if (!keep.has(id)) {
        card.li.remove();
        this.cards.delete(id);
      }
    }
    for (const id of this.order) {
      const song = this.songs.get(id);
      if (!song) continue;
      let card = this.cards.get(id);
      if (!card) {
        card = this._createCard(song);
        this.cards.set(id, card);
      }
      this._fillCard(card, song);
      frag.append(card.li);
    }
    this.$list.append(frag); // re-appending existing nodes keeps them (and focus) intact
    this._renderCount();
  }

  _renderCount() {
    const n = this.order.length;
    const uploading = !!this.currentUpload || this.uploadQueue.length > 0;
    this.$count.textContent = n ? `${n} ${n === 1 ? 'song' : 'songs'}` : '';
    this.$empty.hidden = !(this.loadedOnce && n === 0 && !uploading);
  }

  _updateCard(song) {
    const card = this.cards.get(song.id);
    if (card) this._fillCard(card, song);
  }

  _createCard(song) {
    const refs = {};
    const li = el('li', { class: 'song-card', dataset: { id: song.id } });
    refs.art = el('div', { class: 'song-art', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i'), el('i'));
    refs.title = el('h3', { class: 'song-title' });
    refs.pill = el('span', { class: 'pill' });
    refs.sub = el('p', { class: 'song-sub' });
    refs.stage = el('p', { class: 'song-stage' });
    refs.progress = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, (refs.bar = el('div', { class: 'progress-bar' })));
    refs.chips = el('div', { class: 'song-chips' });
    refs.actions = el('div', { class: 'song-actions' });
    li.append(
      refs.art,
      el('div', { class: 'song-body' }, el('div', { class: 'song-top' }, refs.title, refs.pill), refs.sub, refs.stage, refs.progress, refs.chips),
      refs.actions,
    );
    // Click anywhere on a finished song (except its buttons) to open it.
    li.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input')) return;
      const s = this.songs.get(song.id);
      if (s && s.status === 'done') this.onOpen(s.id);
    });
    return { li, refs, status: null };
  }

  _fillCard(card, song) {
    const { li, refs } = card;
    li.dataset.status = song.status;
    refs.title.textContent = song.title || song.original_filename || 'Untitled';
    refs.title.title = refs.title.textContent;

    const sub = [];
    if (song.original_filename && song.original_filename !== song.title) sub.push(song.original_filename);
    if (song.duration) sub.push(formatTime(song.duration));
    sub.push(modelShort(song.model) + (song.quality === 'high' ? ' · high quality' : ''));
    const date = formatDate(song.created_at);
    if (date) sub.push(date);
    refs.sub.textContent = sub.join(' · ');

    refs.pill.textContent = STATUS_TEXT[song.status] || song.status || '';
    refs.pill.className = `pill pill-${song.status}`;

    refs.stage.textContent = stageText(song);
    refs.stage.classList.toggle('is-error', song.status === 'error');

    const active = isActive(song);
    refs.progress.hidden = !active;
    if (active) {
      const f = song.status === 'queued' ? 0 : fraction(song.progress);
      const indeterminate = song.status === 'processing' && (song.stage === 'loading_model' || song.stage === 'decoding' || song.stage === 'queued');
      refs.progress.classList.toggle('is-indeterminate', indeterminate);
      refs.bar.style.width = indeterminate ? '' : `${Math.round(f * 1000) / 10}%`;
      refs.progress.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      refs.progress.setAttribute('aria-label', `${refs.title.textContent}: ${refs.stage.textContent}`);
    }

    // Colour chips for the parts that were found.
    if (song.status === 'done' && Array.isArray(song.stems)) {
      const key = song.stems.map((s) => s.name + (s.detected === false ? '-' : '+')).join(',');
      if (refs.chips.dataset.key !== key) {
        refs.chips.dataset.key = key;
        refs.chips.replaceChildren(
          ...sortStems(song.stems)
            .filter((s) => s.detected !== false)
            .map((s, i) => el('span', { class: 'chip', style: { '--stem': stemColor(s.name, i) } }, stemLabel(s))),
        );
      }
      refs.chips.hidden = false;
    } else {
      refs.chips.hidden = true;
    }

    if (card.status !== song.status) {
      card.status = song.status;
      this._renderActions(card, song);
    }
  }

  _renderActions(card, song) {
    const id = song.id;
    const btns = [];
    const iconBtn = (cls, icon, label, onClick, text = '') =>
      el('button', { type: 'button', class: `btn ${cls}`, 'aria-label': text ? null : label, title: label, onclick: onClick, html: icon + (text ? `<span>${text}</span>` : '') });

    if (song.status === 'done') {
      btns.push(iconBtn('btn-primary btn-open', ICONS.open, `Open “${song.title}”`, () => this.onOpen(id), 'Open'));
    }
    if (isActive(song)) {
      btns.push(iconBtn('btn-ghost', ICONS.stop, `Cancel splitting “${song.title}”`, (e) => this._cancel(id, e.currentTarget), 'Cancel'));
    }
    if (song.status === 'error' || song.status === 'cancelled') {
      btns.push(iconBtn('btn-secondary', ICONS.retry, `Try splitting “${song.title}” again`, (e) => this._retry(id, e.currentTarget), 'Retry'));
    }
    btns.push(iconBtn('btn-ghost btn-icon btn-delete', ICONS.trash, `Delete “${song.title}”`, () => this._delete(id)));
    card.refs.actions.replaceChildren(...btns);
  }

  async _cancel(id, btn) {
    if (btn) btn.disabled = true;
    try {
      const song = await api.cancelSong(id);
      this._setSong(song);
    } catch (err) {
      this.toast(err.message, { type: 'error' });
      if (btn) btn.disabled = false;
    }
  }

  async _retry(id, btn) {
    if (btn) btn.disabled = true;
    try {
      const song = await api.retrySong(id);
      this._setSong(song);
    } catch (err) {
      this.toast(err.message, { type: 'error' });
      if (btn) btn.disabled = false;
    }
  }

  async _delete(id) {
    const song = this.songs.get(id);
    const title = song ? song.title : 'this song';
    const ok = await this.confirm({
      title: `Delete “${title}”?`,
      message: isActive(song)
        ? 'It is still being split — that will be stopped. The song and all of its parts will be removed from this PC.'
        : 'The song and all of its parts will be removed from this PC. This cannot be undone.',
      okLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.deleteSong(id);
      this._removeSong(id);
      this.toast(`Deleted “${title}”.`);
    } catch (err) {
      if (err.status === 404) this._removeSong(id);
      else this.toast(err.message, { type: 'error' });
    }
  }

  _setSong(song) {
    if (!song || !song.id) return;
    const isNew = !this.songs.has(song.id);
    this.songs.set(song.id, song);
    if (isNew) {
      this.order.unshift(song.id);
      this._renderList();
    } else {
      this._updateCard(song);
    }
    this._renderCount();
    this._schedulePoll();
  }

  _removeSong(id) {
    this.songs.delete(id);
    this.order = this.order.filter((x) => x !== id);
    const card = this.cards.get(id);
    if (card) {
      // Keep keyboard focus somewhere sensible if it was inside the removed card.
      const hadFocus = card.li.contains(document.activeElement);
      const next = card.li.nextElementSibling || card.li.previousElementSibling;
      card.li.remove();
      this.cards.delete(id);
      if (hadFocus) {
        const target = next && next.querySelector('button');
        (target || this.$choose).focus();
      }
    }
    this._renderCount();
  }

  // ---------------------------------------------------------------- uploads

  /** Entry point for the file picker and for files dropped anywhere on the window. */
  async addFiles(files) {
    for (const file of files) {
      const problem = this._checkFile(file);
      if (problem) {
        this.toast(problem, { type: 'error' });
        continue;
      }
      const key = fileKey(file);
      const inFlight = (this.currentUpload && this.currentUpload.key === key) || this.uploadQueue.some((u) => u.key === key);
      if (inFlight) {
        this.toast(`“${file.name}” is already being uploaded.`);
        continue;
      }
      const existing = [...this.songs.values()].find(
        (s) => s.original_filename === file.name && (s.status === 'done' || isActive(s)),
      );
      if (existing) {
        const again = await this.confirm({
          title: `“${file.name}” is already in your library`,
          message: isActive(existing)
            ? 'It is being split right now. Do you want to add it a second time anyway?'
            : 'Do you want to split it again? (Your existing copy stays.)',
          okLabel: 'Split again',
          danger: false,
        });
        if (!again) continue;
        // The same file may have been queued while the question was open.
        if ((this.currentUpload && this.currentUpload.key === key) || this.uploadQueue.some((u) => u.key === key)) continue;
      }
      const item = {
        file,
        key,
        model: this.$model.value || DEFAULT_MODEL,
        quality: this.$quality.value || 'normal',
        row: null,
        handle: null,
        cancelled: false,
      };
      item.row = this._createUploadRow(item);
      this.$uploads.append(item.row.li);
      this.uploadQueue.push(item);
    }
    this._pumpUploads();
  }

  _checkFile(file) {
    const ext = extOf(file.name);
    const type = file.type || '';
    const looksMedia = type.startsWith('audio/') || type.startsWith('video/') || MEDIA_EXTENSIONS.has(ext);
    if (!looksMedia) {
      return `“${file.name}” doesn't look like a song. Please choose an audio file (like MP3, WAV or FLAC) or a video file.`;
    }
    if (file.size === 0) return `“${file.name}” is empty (or is a folder).`;
    if (file.size > MAX_UPLOAD) return `“${file.name}” is too big (${formatBytes(file.size)}). The limit is 500 MB.`;
    return null;
  }

  _createUploadRow(item) {
    const refs = {};
    const li = el(
      'li',
      { class: 'upload-row' },
      el('div', { class: 'upload-info' },
        (refs.name = el('span', { class: 'upload-name', title: item.file.name }, item.file.name)),
        (refs.text = el('span', { class: 'upload-text muted' }, 'Waiting to upload…')),
      ),
      (refs.progress = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': `Uploading ${item.file.name}` },
        (refs.bar = el('div', { class: 'progress-bar' })))),
      (refs.cancel = el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => this._cancelUpload(item) }, 'Cancel')),
    );
    return { li, refs };
  }

  _cancelUpload(item) {
    item.cancelled = true;
    if (item.handle) item.handle.abort();
    const i = this.uploadQueue.indexOf(item);
    if (i !== -1) this.uploadQueue.splice(i, 1);
    item.row.li.remove();
    this._renderCount();
  }

  async _pumpUploads() {
    if (this.currentUpload) return;
    this._setUploadingUI();
    while (this.uploadQueue.length) {
      const item = this.uploadQueue.shift();
      this.currentUpload = item;
      this._setUploadingUI();
      const { refs } = item.row;
      refs.text.textContent = 'Uploading… 0%';
      item.handle = api.uploadSong(item.file, {
        model: item.model,
        quality: item.quality,
        onProgress: (f) => {
          const pct = Math.floor(f * 100);
          refs.bar.style.width = `${f * 100}%`;
          refs.progress.setAttribute('aria-valuenow', String(pct));
          refs.text.textContent = f >= 1 ? 'Upload complete — adding to your library…' : `Uploading… ${pct}% of ${formatBytes(item.file.size)}`;
          if (f >= 1) refs.cancel.disabled = true;
        },
      });
      try {
        const song = await item.handle.promise;
        item.row.li.remove();
        this._setSong(song);
      } catch (err) {
        item.row.li.remove();
        if (!err.aborted && !item.cancelled) {
          this.toast(`Couldn't upload “${item.file.name}”: ${err.message}`, { type: 'error' });
        }
      }
      this.currentUpload = null;
    }
    this._setUploadingUI();
    this._renderCount();
  }

  _setUploadingUI() {
    const busy = !!this.currentUpload || this.uploadQueue.length > 0;
    this.root.querySelector('#dropzone').classList.toggle('is-busy', busy);
    this._renderCount();
  }
}

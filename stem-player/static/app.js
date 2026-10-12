// Entry point: routing between the library and the player, global drag & drop,
// keyboard shortcuts, toasts, confirm dialog and the "server is down" banner.

import { api, onConnectionChange, OFFLINE_MESSAGE } from './api.js';
import { LibraryView } from './library.js';
import { PlayerView } from './playerview.js';
import { el, isTypingTarget } from './util.js';

const $ = (sel) => document.querySelector(sel);

// ------------------------------------------------------------------ toasts

const toastBox = $('#toasts');

/**
 * toast('Saved') / toast('Oops', { type: 'error' }) /
 * toast('Ready', { action: { label: 'Open', onClick } })
 */
export function toast(message, { type = 'info', timeout, action } = {}) {
  const node = el('div', { class: `toast toast-${type}` });
  node.append(el('span', { class: 'toast-text' }, message));
  if (action) {
    node.append(
      el('button', {
        type: 'button',
        class: 'btn btn-small',
        onclick: () => {
          dismiss();
          action.onClick();
        },
      }, action.label),
    );
  }
  const close = el('button', { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss', html: '&times;' });
  node.append(close);
  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    node.classList.add('toast-out');
    setTimeout(() => node.remove(), 200);
  };
  close.addEventListener('click', dismiss);
  toastBox.append(node);
  // Keep at most 4 toasts on screen.
  while (toastBox.children.length > 4) toastBox.firstElementChild.remove();
  const ms = timeout ?? (type === 'error' ? 9000 : action ? 8000 : 4500);
  if (ms > 0) timer = setTimeout(dismiss, ms);
  return dismiss;
}

// ------------------------------------------------------------------ confirm

const confirmDialog = $('#confirm-dialog');

export function confirmBox({ title, message, okLabel = 'OK', danger = true }) {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message || '';
    const ok = $('#confirm-ok');
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    confirmDialog.returnValue = '';
    const onClose = () => {
      confirmDialog.removeEventListener('close', onClose);
      resolve(confirmDialog.returnValue === 'ok');
    };
    confirmDialog.addEventListener('close', onClose);
    confirmDialog.showModal();
    $('#confirm-cancel').focus();
  });
}

// ------------------------------------------------------------------ offline banner

const banner = $('#offline-banner');
let offlineTimer = null;

function setOffline(offline) {
  const wasOffline = !banner.hidden;
  banner.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
  if (offline) {
    $('#offline-text').textContent = OFFLINE_MESSAGE;
    // While down, quietly check every 3 s so the banner disappears by itself.
    if (!offlineTimer) {
      offlineTimer = setInterval(() => {
        api.health().catch(() => {});
      }, 3000);
    }
  } else {
    clearInterval(offlineTimer);
    offlineTimer = null;
    if (wasOffline) {
      if (route.name === 'library') library.refresh();
      toast('Connected to Stem Player again.', { type: 'success' });
    }
  }
}

onConnectionChange((online) => setOffline(!online));

$('#offline-retry').addEventListener('click', async () => {
  const btn = $('#offline-retry');
  btn.disabled = true;
  try {
    await api.health();
  } catch {
    toast(OFFLINE_MESSAGE, { type: 'error' });
  } finally {
    btn.disabled = false;
  }
});

// ------------------------------------------------------------------ views & routing

const libraryScreen = $('#library-screen');
const playerScreen = $('#player-screen');

const library = new LibraryView(libraryScreen, {
  toast,
  confirm: confirmBox,
  onOpen: (id) => navigate('#/song/' + encodeURIComponent(id)),
});

let player = null;
let route = { name: '' };

function parseHash() {
  const h = location.hash || '#/';
  const m = /^#\/song\/([^/?#]+)/.exec(h);
  if (m) {
    let id = m[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      /* keep raw */
    }
    return { name: 'player', id };
  }
  return { name: 'library' };
}

export function navigate(hash) {
  if (location.hash === hash) applyRoute();
  else location.hash = hash;
}

function applyRoute() {
  const next = parseHash();
  if (next.name === route.name && next.id === route.id) return;

  // Leaving the player: stop audio and release the decoded buffers.
  if (player) {
    player.destroy();
    player = null;
  }

  route = next;
  if (next.name === 'player') {
    library.hide();
    libraryScreen.hidden = true;
    playerScreen.hidden = false;
    player = new PlayerView(playerScreen, {
      toast,
      confirm: confirmBox,
      onBack: () => navigate('#/'),
    });
    player.open(next.id);
    window.scrollTo(0, 0);
  } else {
    playerScreen.hidden = true;
    playerScreen.replaceChildren();
    libraryScreen.hidden = false;
    document.title = 'Stem Player';
    library.show();
  }
}

window.addEventListener('hashchange', applyRoute);

// ------------------------------------------------------------------ drag & drop (whole window)

const overlay = $('#drop-overlay');
let dragDepth = 0;
let dragHideTimer = null;

function hasFiles(e) {
  const types = e.dataTransfer && e.dataTransfer.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

function showOverlay() {
  overlay.hidden = false;
  document.body.classList.add('is-dragging');
  clearTimeout(dragHideTimer);
  // dragover keeps firing while a drag is over the window (at least every ~550 ms,
  // even when the pointer is still); if it stops, the drag left or was cancelled.
  dragHideTimer = setTimeout(hideOverlay, 1200);
}

function hideOverlay() {
  dragDepth = 0;
  clearTimeout(dragHideTimer);
  overlay.hidden = true;
  document.body.classList.remove('is-dragging');
}

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  showOverlay();
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); // allow drop (otherwise the browser opens the file)
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  showOverlay();
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) hideOverlay();
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  hideOverlay();
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  if (!files.length) return;
  if (document.querySelector('dialog[open]')) return;
  if (route.name !== 'library') navigate('#/');
  library.addFiles(files);
});

// ------------------------------------------------------------------ keyboard shortcuts

function shortcutsBlocked(e) {
  if (route.name !== 'player' || !player) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (document.querySelector('dialog[open]')) return true;
  if (isTypingTarget(e.target)) return true;
  return false;
}

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || shortcutsBlocked(e)) return;
  if (player.handleKey(e)) e.preventDefault();
});

// Space is handled on keydown; also swallow its keyup so a focused button
// (e.g. the Mute you just clicked) isn't "clicked" again by the same key press.
window.addEventListener('keyup', (e) => {
  if ((e.code === 'Space' || e.key === ' ') && !shortcutsBlocked(e)) e.preventDefault();
});

// ------------------------------------------------------------------ start

library.init();
applyRoute();

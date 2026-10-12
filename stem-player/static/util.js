// Small shared helpers: DOM building, time formatting, stem colours, safe storage.

/** Display order for the parts. Unknown stems go after these, in server order. */
export const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

const STEM_COLORS = {
  vocals: '#ff5fa2',
  drums: '#ff9f43',
  bass: '#4da3ff',
  guitar: '#3ddc84',
  piano: '#a77bff',
  other: '#a3abb8',
};
const EXTRA_COLORS = ['#2dd4bf', '#facc15', '#f87171', '#60a5fa'];

export function stemColor(name, index = 0) {
  return STEM_COLORS[name] || EXTRA_COLORS[index % EXTRA_COLORS.length];
}

export function stemLabel(stem) {
  if (stem && stem.label) return stem.label;
  const n = (stem && stem.name) || String(stem || '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Sort meta.stems into the canonical display order (stable for unknown names). */
export function sortStems(stems) {
  const list = Array.isArray(stems) ? stems.slice() : [];
  const rank = (s) => {
    const i = STEM_ORDER.indexOf(s.name);
    return i === -1 ? STEM_ORDER.length : i;
  };
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s);
}

/** mm:ss (or h:mm:ss for very long files). */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${String(m).padStart(2, '0')}:${ss}`;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Tiny element builder.
 *   el('button', { class: 'btn', onclick: fn, 'aria-label': 'Play' }, 'Play')
 * Attributes starting with "on" become listeners; `dataset`/`style` objects are merged;
 * boolean true sets an empty attribute, false/null/undefined skip it.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2), v);
    } else if (k === 'dataset') {
      Object.assign(node.dataset, v);
    } else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) node.style.setProperty(sk, sv);
    } else if (k === 'class') {
      node.className = v;
    } else if (k === 'text') {
      node.textContent = v;
    } else if (k === 'html') {
      node.innerHTML = v; // only ever used with static, trusted markup (icons)
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendChildren(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** localStorage that never throws (private mode, blocked storage, ...). */
export const store = {
  get(key, fallback = null) {
    try {
      const v = window.localStorage.getItem('stemPlayer.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem('stemPlayer.' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/** Is the event target somewhere the user types text (so shortcuts must not fire)? */
export function isTypingTarget(t) {
  if (!t || !(t instanceof Element)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t.getAttribute('type') || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color'].includes(type);
  }
  return false;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  if (mb >= 10) return Math.round(mb) + ' MB';
  return mb.toFixed(1) + ' MB';
}

/** Gains are sent to /mix as plain decimals ("1", "0.6", "1.25"). */
export function formatGain(g) {
  return String(Number(clamp(g, 0, 2).toFixed(2)));
}

/** Inline SVG icons (no text inside). */
export const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>',
  toStart: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="5" width="2.6" height="14" rx="1" fill="currentColor"/><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.3 13.2a1.4 1.4 0 0 1 0-2.4l8.15-5.43A1 1 0 0 1 19 6.2z" fill="currentColor"/></svg>',
  loop: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3m13-2v2a3 3 0 0 1-3 3H4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.6a.6.6 0 0 0 1-.47V5.37a.6.6 0 0 0-1-.47L8 8.5H5a1 1 0 0 0-1 1z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M10 7V5h4v2m-7 0l.8 12h8.4L17 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  retry: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>',
  upload: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 31V11m0 0l-8 8m8-8l8 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 29v6a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4v-6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  mix: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4v16M12 4v16M18 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3.5" y="13" width="5" height="3" rx="1.2" fill="currentColor"/><rect x="9.5" y="7" width="5" height="3" rx="1.2" fill="currentColor"/><rect x="15.5" y="15" width="5" height="3" rx="1.2" fill="currentColor"/></svg>',
};

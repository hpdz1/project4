// Thin client for the Stem Player HTTP API (see docs/DESIGN.md, "HTTP API").
// Every failure becomes an ApiError with a friendly, human-readable message.

export const OFFLINE_MESSAGE =
  "Stem Player isn't running — start it with Start Stem Player.bat";

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false, aborted = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline;
    this.aborted = aborted;
  }
}

// Listeners told whenever we learn the server is reachable / unreachable.
const connectionListeners = new Set();
export function onConnectionChange(fn) {
  connectionListeners.add(fn);
  return () => connectionListeners.delete(fn);
}
function reportConnection(online) {
  for (const fn of connectionListeners) {
    try {
      fn(online);
    } catch (e) {
      console.error(e);
    }
  }
}

function songPath(id) {
  return '/api/songs/' + encodeURIComponent(id);
}

function detailMessage(data, status) {
  const d = data && data.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d) && d.length) {
    // FastAPI validation errors: [{loc, msg, type}, ...]
    return d.map((x) => (x && x.msg) || String(x)).join('; ');
  }
  if (status === 404) return 'That song was not found — it may have been deleted.';
  if (status === 413) return 'That file is too big (the limit is 500 MB).';
  if (status >= 500) return `Stem Player hit a problem (error ${status}). Please try again.`;
  return `Something went wrong (error ${status}).`;
}

async function request(method, path, body, { signal } = {}) {
  const opts = { method, headers: { Accept: 'application/json' }, signal };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    if (err && err.name === 'AbortError') throw new ApiError('Cancelled.', { aborted: true });
    reportConnection(false);
    throw new ApiError(OFFLINE_MESSAGE, { offline: true });
  }
  reportConnection(true);
  let data = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) throw new ApiError(detailMessage(data, res.status), { status: res.status });
  return data;
}

export const api = {
  health: () => request('GET', '/api/health'),

  listSongs: async () => {
    const data = await request('GET', '/api/songs');
    return (data && Array.isArray(data.songs)) ? data.songs : [];
  },

  getSong: async (id, opts) => (await request('GET', songPath(id), undefined, opts)).song,

  renameSong: async (id, title) => (await request('PATCH', songPath(id), { title })).song,

  deleteSong: (id) => request('DELETE', songPath(id)),

  cancelSong: async (id) => (await request('POST', songPath(id) + '/cancel')).song,

  retrySong: async (id) => (await request('POST', songPath(id) + '/retry')).song,

  getPeaks: (id, opts) => request('GET', songPath(id) + '/peaks', undefined, opts),

  stemUrl(id, stem, { download = false } = {}) {
    return `${songPath(id)}/stems/${encodeURIComponent(stem)}.wav${download ? '?download=1' : ''}`;
  },

  originalUrl(id) {
    return songPath(id) + '/original';
  },

  /** parts: [{ name, gain }] with gain 0..2; format: "wav" | "mp3". */
  mixUrl(id, parts, format) {
    const stems = parts.map((p) => `${p.name}:${p.gain}`).join(',');
    const q = new URLSearchParams({ stems, format });
    return `${songPath(id)}/mix?${q.toString()}`;
  },

  /**
   * Upload with progress (fetch cannot report upload progress, XHR can).
   * Returns { promise, abort }. promise resolves to the created song meta.
   * onProgress(fraction 0..1, loadedBytes, totalBytes).
   */
  uploadSong(file, { model, quality, onProgress } = {}) {
    const xhr = new XMLHttpRequest();
    let aborted = false;
    const promise = new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file, file.name);
      if (model) form.append('model', model);
      if (quality) form.append('quality', quality);

      xhr.open('POST', '/api/songs');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.responseType = 'text';
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total, e.loaded, e.total);
      };
      xhr.onload = () => {
        reportConnection(true);
        let data = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data && data.song) {
          resolve(data.song);
        } else {
          reject(new ApiError(detailMessage(data, xhr.status), { status: xhr.status }));
        }
      };
      xhr.onerror = () => {
        if (aborted) return;
        reportConnection(false);
        reject(new ApiError(OFFLINE_MESSAGE, { offline: true }));
      };
      xhr.onabort = () => reject(new ApiError('Upload cancelled.', { aborted: true }));
      xhr.send(form);
    });
    return {
      promise,
      abort() {
        aborted = true;
        xhr.abort();
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
//  SHELL — view mounting, modal helper, connectivity flag
// ─────────────────────────────────────────────────────────────
import { el, clear, $ } from '../util.js';

export const viewRoot = () => $('#view');

export function mount(node) {
  const root = viewRoot();
  clear(root);
  root.append(node);
  root.scrollIntoView({ block: 'start', behavior: 'auto' });
}

export function showError(message, detail) {
  mount(el('div', {},
    el('div', { class: 'notice notice-warn' }, message),
    detail && el('pre', { class: 'small faint', style: 'white-space:pre-wrap' }, detail),
  ));
}

export function loading(text = 'Memuat…') {
  mount(el('p', { class: 'muted', text }));
}

/**
 * Modal dialog. Returns { dialog, body, close } so callers build
 * their own footer buttons.
 */
export function openDialog(title, { wide = false } = {}) {
  const body = el('div', { class: 'dialog-body' });
  const foot = el('div', { class: 'dialog-foot' });
  const dialog = el('dialog', wide ? { style: 'width:min(920px,calc(100vw - 24px))' } : {},
    el('div', { class: 'dialog-head' },
      el('h2', { text: title }),
      el('button', { class: 'btn-sm btn-ghost', 'aria-label': 'Tutup',
        onClick: () => close() }, '✕'),
    ),
    body, foot,
  );
  function close() {
    dialog.close();
    dialog.remove();
  }
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, foot, close };
}

/** Confirm that does not rely on window.confirm (blocked in some
    standalone PWA contexts). */
export function confirmDialog(title, message, confirmLabel = 'Hapus') {
  return new Promise((resolve) => {
    const { body, foot, close } = openDialog(title);
    body.append(el('p', { text: message }));
    foot.append(
      el('button', { onClick: () => { close(); resolve(false); } }, 'Batal'),
      el('button', { class: 'btn-danger', onClick: () => { close(); resolve(true); } }, confirmLabel),
    );
  });
}

/** Connectivity flag. Advisory only — writes still queue offline
    via Firestore's own outbox, so this never gates an action. */
export function watchConnectivity() {
  const apply = () => document.body.classList.toggle('is-offline', !navigator.onLine);
  window.addEventListener('online', apply);
  window.addEventListener('offline', apply);
  apply();
}

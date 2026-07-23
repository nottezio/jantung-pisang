// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────

/* ── IDs ──────────────────────────────────────────────────────
   Section keys must be stable, opaque and never derived from
   user-typed text (Firestore map keys reject . / ~ * [ ] and the
   __ prefix). "s_" + 12 url-safe chars satisfies all of that.   */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function uid(prefix = '', len = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return prefix + out;
}
export const sectionKey = () => uid('s_');
export const fieldKey   = () => uid('f_');
export const itemKey    = () => uid('i_');

export const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/* ── DOM ────────────────────────────────────────────────────── */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export function toast(message) {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status', text: message });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

/* ── Dates ──────────────────────────────────────────────────── */
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
               'Agustus','September','Oktober','November','Desember'];

/** Local-time YYYY-MM-DD. Never use toISOString() — it shifts to UTC
    and produces yesterday's date for anyone east of Greenwich,
    which includes WITA. */
export function isoDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const parseDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};
export function formatDateID(iso, withDay = false) {
  const d = parseDate(iso);
  if (!d) return '';
  const base = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${HARI[d.getDay()]}, ${base}` : base;
}
/** Parse a date the way a person types one under time pressure.
    Accepts 14/3/1968 · 14-03-1968 · 14031968 · 1968-03-14.
    The native date picker is precise and slow; this is neither
    ambiguous nor slow, because day-first is unambiguous here:
    a four-digit leading group can only be a year. */
export function parseFlexibleDate(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const p = n => String(n).padStart(2, '0');

  let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return `${m[1]}-${p(m[2])}-${p(m[3])}`;

  m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return `${m[3]}-${p(m[2])}-${p(m[1])}`;

  m = raw.replace(/\D/g, '').match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return '';
}

/** Render an ISO date back into the day-first form people type. */
export function toTypedDate(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const shiftDays = (iso, n) => {
  const d = parseDate(iso); if (!d) return '';
  d.setDate(d.getDate() + n); return isoDate(d);
};

/* ── Computed clinical values (never stored) ────────────────── */

/** Age in whole years from DOB. Hard requirement #5. */
export function computeAge(dob, on = new Date()) {
  const b = parseDate(dob);
  if (!b) return '';
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age >= 0 ? age : '';
}

/** Day 1 = admission day itself, per ward convention. */
export function computeHariPerawatan(admissionDate, on = new Date()) {
  const a = parseDate(admissionDate);
  if (!a) return '';
  const days = Math.floor((parseDate(isoDate(on)) - a) / 86400000);
  return days >= 0 ? days + 1 : '';
}

/** Initials for de-identified output (Morning Report, Phase 4). */
export function computeInitial(name) {
  return String(name || '').trim().split(/\s+/)
    .filter(w => /[A-Za-zÀ-ÿ]/.test(w))
    .map(w => w[0].toUpperCase()).join('');
}

/** Greeting keyed to configurable hour cutoffs. */
export function computeGreeting(cutoffs, now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  const c = cutoffs || { pagi: 11, siang: 15, sore: 18 };
  if (h < c.pagi)  return 'pagi';
  if (h < c.siang) return 'siang';
  if (h < c.sore)  return 'sore';
  return 'malam';
}

/* ── Sorting ────────────────────────────────────────────────── */

/** Room/bed sort that treats embedded digits numerically, so
    "Kamar 2" sorts before "Kamar 10". */
export function compareNatural(a, b) {
  const norm = (s) => String(s ?? '').toLowerCase()
    .split(/(\d+)/).map(p => (/^\d+$/.test(p) ? p.padStart(10, '0') : p)).join('');
  return norm(a).localeCompare(norm(b));
}

export function locationFull(loc) {
  if (!loc) return '';
  const { ward, floor, room, bed } = loc;
  return [
    ward,
    floor && `Lt ${floor}`,
    room  && `Kamar ${room}`,
    bed   && `Bed ${bed}`,
  ].filter(Boolean).join(' ');
}

/* ── Misc ───────────────────────────────────────────────────── */
export const debounce = (fn, ms = 300) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/**
 * Strip WhatsApp markup for pasting into SIMGOS CPPT, which renders
 * asterisks and underscores literally.
 *
 * Only paired markers on a single line are removed, so a lone
 * asterisk in a dose ("2x1 tab*") or an underscore inside a word
 * survives untouched. Line structure is never altered.
 */
export function stripWaMarkup(text) {
  return String(text ?? '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~([^~\n]+)~/g, '$1');
}

/* ── WhatsApp markup → HTML, for display only ────────────────
   The plain text stays the source of truth. This never writes back
   to the stored note: a formatted view that silently re-serialises
   its own HTML would corrupt exactly the asterisks the report
   depends on.

   Escaping happens FIRST, so a note containing "<0.01" or an
   ampersand renders as text and can never inject markup. */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function waToHtml(text) {
  let out = escapeHtml(text);
  // Same conservative pairing as stripWaMarkup: markers must open
  // and close on one line, so a lone asterisk in a dose survives.
  out = out.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
  out = out.replace(/_([^_\n]+)_/g, '<i>$1</i>');
  out = out.replace(/~([^~\n]+)~/g, '<s>$1</s>');
  out = out.replace(/```([^`\n]+)```/g, '<code>$1</code>');
  return out;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back for
    // http:// LAN testing.
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

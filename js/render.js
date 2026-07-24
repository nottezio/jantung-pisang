// ═══════════════════════════════════════════════════════════
//  RENDER ENGINE
// ═══════════════════════════════════════════════════════════
import Mustache from '../vendor/mustache.mjs';
import { getType } from './schema.js';
import {
  computeAge, computeHariPerawatan, computeInitial, computeGreeting,
  formatDateID, isoDate, shiftDays, locationFull,
} from './util.js';
import { REPORT_TYPES } from './seed.js';

// ⚠️ HARD REQUIREMENT #8 — THE OUTPUT TARGET IS PLAIN TEXT.
//
// Mustache escapes for HTML by default. Untouched, it turns
//   Nur'aini      → Nur&#39;aini
//   Troponin <0.01 → Troponin &lt;0.01
// Apostrophes in Indonesian names and "<" in lab values are daily
// occurrences, not edge cases.
//
// This is set globally rather than by using {{{triple braces}}},
// because the user hand-edits these templates and will write
// {{ }}. The escape policy belongs in the engine, not in the
// template string.
Mustache.escape = (text) => (text == null ? '' : String(text));

/* ── Context assembly ───────────────────────────────────────── */

function investigationContext(patient, entry) {
  const ids = new Set(entry?.includedInvestigationIds || []);
  return (patient?.investigations || [])
    .filter(inv => ids.has(inv.id))
    // Chronological, so a month of studies reads in order.
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map(inv => ({
      type: inv.type || '',
      subtype: inv.subtype || '',
      location: inv.location || '',
      date: formatDateID(inv.date),
      content: inv.content || '',
      values: (inv.values || []).filter(v => v.label || v.value),
    }));
}

/**
 * Build the mustache view.
 * Everything derived — age, hari perawatan, initials, greeting —
 * is computed here and never stored. Hard requirement #5.
 */
export function buildContext({ patient, entry, template, settings, now = new Date() }) {
  const today = isoDate(now);
  const cutoffs = settings?.greetingCutoffs;
  const greeting = computeGreeting(cutoffs, now);
  const salam = settings?.salamMode === 'waktu'
    ? `${settings?.greetingPrefix || 'Selamat'} ${greeting}`
    : (settings?.salamText || 'Assalamualaikum');

  const rt = REPORT_TYPES.find(r => r.value === (entry?.reportType || template?.reportType));

  const ctx = {
    salam,
    greeting,
    today: formatDateID(today, true),
    yesterday: formatDateID(shiftDays(today, -1), true),
    entryDate: formatDateID(entry?.date),
    reportType: { value: rt?.value || '', label: rt?.label || '' },

    patient: {
      name: patient?.name || '',
      initial: computeInitial(patient?.name),
      dob: formatDateID(patient?.dob),
      dobIso: patient?.dob || '',
      age: computeAge(patient?.dob, now),
      gender: patient?.gender || '',
      mrn: patient?.mrn || '',
      insurance: patient?.insurance || '',
      mainDiagnosis: patient?.mainDiagnosis || '',
    },
    location: { ...(patient?.location || {}), full: locationFull(patient?.location) },
    // Falsy when absent, so {{#previousLocation}}…{{/previousLocation}}
    // suppresses the whole "dari X ke Y" clause for non-transfers.
    previousLocation: patient?.previousLocation
      ? { ...patient.previousLocation, full: locationFull(patient.previousLocation) }
      : null,
    transferDate: formatDateID(patient?.transferDate),
    dpjp: groupDpjpByName(patient?.dpjp),
    source: patient?.source?.dept || '',
    referringDoctor: patient?.source?.referringDoctor || '',
    hariPerawatan: computeHariPerawatan(patient?.admissionDate, now),
    admissionDate: formatDateID(patient?.admissionDate),
  };

  // ── Section values, projected per type ──────────────────────
  // The loop is over the TEMPLATE's sections. Nothing here names
  // a clinical concept.
  for (const s of template?.sections || []) {
    const t = getType(s.type);
    if (s.type === 'dated-repeat') {
      ctx[s.key] = investigationContext(patient, entry);
      continue;
    }
    const raw = entry?.sections?.[s.key];
    ctx[s.key] = t.isEmpty(raw) ? falsyFor(s.type) : t.render(raw, s.config);
  }

  return ctx;
}

/* An empty section must be FALSY so that {{#section}}…{{/section}}
   suppresses its whole block, including the heading. Otherwise an
   unfilled section emits a bare "*S:*" with nothing under it. */
function falsyFor(type) {
  switch (type) {
    case 'bullets':
    case 'lines':
    case 'fixed-items':
    case 'flagged-values':
    case 'sub-blocks':
    case 'dated-repeat':
      return [];
    case 'keyvalue':
      return {};
    default:
      return '';
  }
}

/**
 * One consultant holding several roles should be one line, not
 * several: "DPJP Utama dan Tindakan : dr. X", never two lines
 * naming the same person.
 *
 * Grouping is by name, and first-appearance order is preserved so
 * Utama still leads. Subsequent roles drop their "DPJP " prefix so
 * the label reads as a sentence rather than a list of headings.
 */
function groupDpjpByName(list) {
  const byName = new Map();
  for (const d of list || []) {
    const name = String(d?.name || '').trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { name, roles: [] });
    const entry = byName.get(name);
    const role = String(d.role || '').trim();
    if (role && !entry.roles.includes(role)) entry.roles.push(role);
  }
  return [...byName.values()].map(({ name, roles }) => ({
    name,
    role: joinRoles(roles),
    roles,
  }));
}

function joinRoles(roles) {
  if (!roles.length) return 'DPJP';
  if (roles.length === 1) return roles[0];
  const [first, ...rest] = roles;
  const tail = rest.map(r => r.replace(/^DPJP\s+/i, ''));
  return `${first} dan ${tail.join(' dan ')}`;
}

/* ── Render ─────────────────────────────────────────────────── */

export function renderReport({ patient, entry, template, settings, now }) {
  const ctx = buildContext({ patient, entry, template, settings, now });
  try {
    const out = Mustache.render(template?.render || '', ctx);
    return { ok: true, text: tidy(out), error: null };
  } catch (err) {
    // A malformed template must never lose the user's data — show
    // the error, keep the entry intact.
    return { ok: false, text: '', error: err?.message || String(err) };
  }
}

/* Collapse runs of 3+ blank lines that appear when optional
   blocks are suppressed. Deliberately conservative: single and
   double blank lines are preserved, because the reference
   documents rely on them. */
function tidy(text) {
  return String(text)
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '') + '\n';
}

/** Validate a template string without committing it. */
export function validateTemplate(str) {
  try { Mustache.parse(String(str || '')); return { ok: true, error: null }; }
  catch (err) { return { ok: false, error: err?.message || String(err) }; }
}

/** Slots the render string references — used by Settings to warn
    about tags that no section or computed slot provides. */
export function referencedTags(str) {
  const tags = new Set();
  try {
    const walk = (nodes) => {
      for (const n of nodes) {
        const [type, name, , , children] = n;
        if (['name', '#', '^', '&'].includes(type)) tags.add(String(name).split('.')[0]);
        if (Array.isArray(children)) walk(children);
      }
    };
    walk(Mustache.parse(String(str || '')));
  } catch { /* invalid template — Settings reports it separately */ }
  tags.delete('.');
  return [...tags];
}

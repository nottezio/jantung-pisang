// ═══════════════════════════════════════════════════════════
//  SECTION TYPE REGISTRY — the nine primitives.
//
//  This file is the ONLY place that knows about section shapes.
//  It knows nothing about cardiology: no "vitals", no "faktor
//  risiko", no "Tekanan Darah". Those live in seed.js as DATA.
//
//  Adding a clinical concept  → edit a template (no code).
//  Adding a NEW primitive     → edit this file (rare).
// ═══════════════════════════════════════════════════════════

/* ── Section keys ─────────────────────────────────────────────
   A key is a human-readable slug, chosen once at section
   creation and IMMUTABLE thereafter, because the render string
   references it ({{subjective}}, {{vitals.bp}}).

   `label` is the display name and is freely renamable — renaming
   it never breaks the render string or orphans stored data.

   The regex also satisfies Firestore's map-key constraints
   (no . / ~ * [ ], no __ prefix).                              */
export const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export function validateKey(key, existingKeys = []) {
  if (!KEY_RE.test(key)) {
    return 'Kunci harus huruf kecil, angka, underscore; diawali huruf.';
  }
  if (existingKeys.includes(key)) return 'Kunci sudah dipakai.';
  return null;
}

export function slugify(label) {
  return String(label || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .replace(/^([^a-z])/, 's_$1').slice(0, 40) || 'bagian';
}

/* ── The registry ───────────────────────────────────────────── */

const nonEmpty = (s) => String(s ?? '').trim() !== '';

export const SECTION_TYPES = {

  text: {
    label: 'Teks bebas',
    hint: 'Satu blok prosa bebas.',
    // config.default seeds a blank entry with a skeleton the user
    // types into — "Tekanan Darah :" and so on. This is what lets a
    // whole multi-field block be one textarea instead of six inputs.
    blank: (cfg) => String(cfg?.default ?? ''),
    normalize: (v, cfg) => (typeof v === 'string' ? v : String(cfg?.default ?? '')),
    isEmpty: (v) => !nonEmpty(v),
    render: (v) => String(v ?? ''),
  },

  bullets: {
    label: 'Daftar poin',
    hint: 'Daftar baris yang bisa ditambah, dihapus, dan diurutkan.',
    blank: (cfg) => (cfg?.default ? String(cfg.default).split('\n') : []),
    // Accepts a raw string so the editor can be a plain textarea:
    // one line per item, no "+ add row" button.
    normalize: (v, cfg) => {
      if (typeof v === 'string') return v.split('\n');
      if (Array.isArray(v)) return v.map(x => String(x ?? ''));
      return cfg?.default ? String(cfg.default).split('\n') : [];
    },
    isEmpty: (v) => !(v || []).some(nonEmpty),
    // Empty lines are dropped at render so a half-filled list
    // never emits a stray "- " into the WhatsApp message.
    render: (v) => (v || []).filter(nonEmpty).map(s => String(s).trim()),
  },

  'fixed-items': {
    label: 'Item tetap',
    hint: 'Daftar label tetap; tiap label diisi status dan keterangan.',
    blank: (cfg) => (cfg?.items || []).map(it => ({
      key: it.key, label: it.label, status: it.defaultStatus || '', detail: '',
    })),
    normalize: (v, cfg) => {
      const stored = new Map((Array.isArray(v) ? v : []).map(x => [x.key, x]));
      return (cfg?.items || []).map(it => {
        const s = stored.get(it.key) || {};
        return {
          key: it.key,
          label: it.label,                 // label always from config,
          status: s.status ?? '',          // so renaming propagates
          detail: s.detail ?? '',
        };
      });
    },
    isEmpty: (v) => !(v || []).some(x => nonEmpty(x.status) || nonEmpty(x.detail)),
    render: (v, cfg) => {
      const includeBlank = cfg?.includeBlank === true;
      return (v || [])
        .filter(x => includeBlank || nonEmpty(x.status) || nonEmpty(x.detail))
        .map(x => ({ label: x.label, status: x.status || '', detail: x.detail || '' }));
    },
  },

  keyvalue: {
    label: 'Pasangan kunci-nilai',
    hint: 'Sekumpulan field bernama dengan urutan tetap.',
    blank: (cfg) => Object.fromEntries((cfg?.fields || []).map(f => [f.key, f.default ?? ''])),
    normalize: (v, cfg) => {
      const src = (v && typeof v === 'object') ? v : {};
      const out = {};
      for (const f of cfg?.fields || []) out[f.key] = String(src[f.key] ?? '');
      return out;
    },
    isEmpty: (v) => !Object.values(v || {}).some(nonEmpty),
    // Rendered as an object so the template can address fields
    // individually: {{vitals.bp}}.
    render: (v) => ({ ...(v || {}) }),
  },

  lines: {
    label: 'Baris berlabel',
    hint: 'Baris berlabel tetap, isinya teks bebas.',
    blank: (cfg) => (cfg?.lines || []).map(l => ({ key: l.key, label: l.label, value: '' })),
    normalize: (v, cfg) => {
      const stored = new Map((Array.isArray(v) ? v : []).map(x => [x.key, x]));
      return (cfg?.lines || []).map(l => ({
        key: l.key, label: l.label, value: stored.get(l.key)?.value ?? '',
      }));
    },
    isEmpty: (v) => !(v || []).some(x => nonEmpty(x.value)),
    // Flattened to plain strings: {{#exam}}{{.}}{{/exam}}
    render: (v, cfg) => {
      const showLabel = cfg?.showLabel !== false;
      return (v || []).filter(x => nonEmpty(x.value)).map(x =>
        showLabel && nonEmpty(x.label) ? `${x.label}: ${x.value}` : String(x.value)
      );
    },
  },

  'dated-repeat': {
    label: 'Pemeriksaan bertanggal',
    hint: 'Tidak disimpan di entri. Diambil dari daftar pemeriksaan pasien.',
    // ⚠️ Hard requirement #4: investigations live on the PATIENT.
    // The entry stores only includedInvestigationIds. There is
    // nothing to store here, ever.
    virtual: true,
    blank: () => null,
    normalize: () => null,
    isEmpty: () => true,
    render: () => [],   // populated by render.js from the patient
  },

  'flagged-values': {
    label: 'Nilai dengan tanda abnormal',
    hint: 'Label + nilai + centang abnormal. Abnormal dicetak *tebal*.',
    blank: () => [],
    normalize: (v) => (Array.isArray(v) ? v : []).map(x => ({
      label: String(x?.label ?? ''), value: String(x?.value ?? ''), abnormal: !!x?.abnormal,
    })),
    isEmpty: (v) => !(v || []).some(x => nonEmpty(x.label) || nonEmpty(x.value)),
    render: (v) => (v || []).filter(x => nonEmpty(x.label) || nonEmpty(x.value)),
  },

  'sub-blocks': {
    label: 'Blok berulang A/P/T',
    hint: 'Blok berulang, masing-masing berisi beberapa sub-daftar.',
    blank: () => [],
    normalize: (v, cfg) => {
      const lists = cfg?.lists || [
        { key: 'assessment', label: 'A' },
        { key: 'plan',       label: 'P' },
        { key: 'therapy',    label: 'T' },
      ];
      const titleKey = cfg?.titleKey || 'dept';
      return (Array.isArray(v) ? v : []).map(b => {
        const out = { [titleKey]: String(b?.[titleKey] ?? '') };
        for (const l of lists) {
          out[l.key] = Array.isArray(b?.[l.key]) ? b[l.key].map(s => String(s ?? '')) : [];
        }
        return out;
      });
    },
    isEmpty: (v) => !(v || []).length,
    render: (v, cfg) => {
      const lists = cfg?.lists || [
        { key: 'assessment' }, { key: 'plan' }, { key: 'therapy' },
      ];
      const titleKey = cfg?.titleKey || 'dept';
      return (v || []).map(b => {
        const out = { [titleKey]: b[titleKey] || '' };
        for (const l of lists) out[l.key] = (b[l.key] || []).filter(nonEmpty);
        return out;
      });
    },
  },

  formula: {
    label: 'Pilihan + kalimat',
    hint: 'Pilihan dari daftar yang menghasilkan satu kalimat, lalu bisa disunting.',
    blank: () => ({ selected: '', sentence: '' }),
    normalize: (v) => ({
      selected: String(v?.selected ?? ''),
      sentence: String(v?.sentence ?? ''),
    }),
    isEmpty: (v) => !nonEmpty(v?.sentence) && !nonEmpty(v?.selected),
    // The resolved sentence wins; the picklist is an input aid.
    render: (v, cfg) => {
      if (nonEmpty(v?.sentence)) return v.sentence;
      const opt = (cfg?.options || []).find(o => o.value === v?.selected);
      return opt ? (opt.sentence || opt.label) : '';
    },
  },
};

export const TYPE_IDS = Object.keys(SECTION_TYPES);
export const getType = (id) => SECTION_TYPES[id] || SECTION_TYPES.text;

/* ── Whole-entry helpers ────────────────────────────────────── */

/** Build a blank sections map for a template. */
export function blankSections(template) {
  const out = {};
  for (const s of template?.sections || []) {
    const t = getType(s.type);
    if (t.virtual) continue;
    out[s.key] = t.blank(s.config);
  }
  return out;
}

/**
 * Reconcile a stored sections map against the current template.
 *
 * ORPHAN POLICY — RETAIN AND HIDE.
 * Keys not present in the template are preserved untouched. They
 * do not render and are not editable, but they survive in
 * Firestore and reappear intact if the section is re-added.
 * ⛔ Never purge: that would destroy clinical history.
 */
export function normalizeSections(stored, template) {
  const src = (stored && typeof stored === 'object') ? stored : {};
  const out = { ...src };
  for (const s of template?.sections || []) {
    const t = getType(s.type);
    if (t.virtual) { delete out[s.key]; continue; }
    out[s.key] = t.normalize(src[s.key], s.config);
  }
  return out;
}

/** Keys held by the entry that the active template no longer declares. */
export function orphanKeys(stored, template) {
  const known = new Set((template?.sections || []).map(s => s.key));
  return Object.keys(stored || {}).filter(k => !known.has(k));
}

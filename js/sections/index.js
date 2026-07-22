// ═══════════════════════════════════════════════════════════
//  SECTION EDITORS — nine components, one per primitive.
//
//  This is the file that makes the open map real. The SOAP editor
//  loops over template.sections[] and dispatches here on `type`.
//  Nine components, fixed forever — instead of one component per
//  clinical concept, growing without bound.
//
//  ⛔ Nothing in this file may name a clinical concept. If you
//     find yourself writing "vitals" or "Tekanan Darah" here,
//     it belongs in a template's config, not in code.
// ═══════════════════════════════════════════════════════════
import { el, clear, uid, isoDate, formatDateID } from '../util.js';
import { getType } from '../schema.js';

/* ── Shared building blocks ─────────────────────────────────── */

function fieldWrap(labelText, control, hint) {
  return el('div', { class: 'field' },
    labelText && el('label', { text: labelText }),
    control,
    hint && el('div', { class: 'small faint', text: hint }),
  );
}

function iconBtn(label, title, onClick, extraClass = '') {
  return el('button', {
    class: `btn-sm btn-ghost ${extraClass}`, type: 'button',
    title, 'aria-label': title, onClick,
  }, label);
}

/**
 * Editable list of plain strings. Used directly by `bullets` and
 * reused inside `sub-blocks`.
 */
function stringListEditor(values, onChange, cfg = {}) {
  const wrap = el('div');
  let list = [...(values || [])];

  const commit = () => onChange([...list]);

  function redraw(focusIndex = null) {
    clear(wrap);
    list.forEach((val, i) => {
      const input = el(cfg.multiline ? 'textarea' : 'input', {
        value: val,
        placeholder: cfg.placeholder || '',
        rows: cfg.multiline ? 2 : null,
        onInput: (e) => { list[i] = e.target.value; commit(); },
        onKeydown: (e) => {
          // Enter adds the next line — the whole point of a bullet
          // list is fast sequential entry.
          if (e.key === 'Enter' && !cfg.multiline) {
            e.preventDefault();
            list.splice(i + 1, 0, '');
            commit(); redraw(i + 1);
          }
          if (e.key === 'Backspace' && !e.target.value && list.length > 1) {
            e.preventDefault();
            list.splice(i, 1);
            commit(); redraw(Math.max(0, i - 1));
          }
        },
      });
      if (cfg.multiline) input.value = val;
      wrap.append(el('div', { class: 'bullet-row' },
        input,
        iconBtn('✕', 'Hapus baris', () => {
          list.splice(i, 1); commit(); redraw();
        }, 'btn-danger'),
      ));
    });

    wrap.append(el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn-sm', type: 'button',
        onClick: () => { list.push(''); commit(); redraw(list.length - 1); },
      }, '+ Tambah baris'),
    ));

    if (focusIndex != null) {
      const inputs = wrap.querySelectorAll('input, textarea');
      inputs[focusIndex]?.focus();
    }
  }

  redraw();
  return wrap;
}

/* ── The nine editors ───────────────────────────────────────── */

const EDITORS = {

  /* 1 ── text ─────────────────────────────────────────────── */
  text(section, value, onChange) {
    return el('textarea', {
      placeholder: section.config?.placeholder || '',
      rows: section.config?.rows || 3,
      onInput: (e) => onChange(e.target.value),
    }, value || '');
  },

  /* 2 ── bullets ──────────────────────────────────────────── */
  bullets(section, value, onChange) {
    return stringListEditor(value, onChange, {
      placeholder: section.config?.placeholder || '',
      multiline: section.config?.multiline === true,
    });
  },

  /* 3 ── fixed-items ──────────────────────────────────────── */
  'fixed-items'(section, value, onChange) {
    const items = value || [];
    const opts = section.config?.statusOptions || [];
    const wrap = el('div');

    items.forEach((item, i) => {
      const update = (patch) => {
        const next = items.map((x, j) => (j === i ? { ...x, ...patch } : x));
        onChange(next);
      };

      const statusControl = opts.length
        ? el('select', { onChange: (e) => update({ status: e.target.value }) },
            el('option', { value: '' }, '—'),
            ...opts.map(o => el('option', { value: o, selected: item.status === o }, o)),
          )
        : el('input', {
            value: item.status || '', placeholder: 'status',
            onInput: (e) => update({ status: e.target.value }),
          });

      wrap.append(el('div', { class: 'field' },
        el('label', { text: item.label }),
        el('div', { class: 'field-row' },
          statusControl,
          el('input', {
            value: item.detail || '',
            placeholder: section.config?.detailPlaceholder || 'keterangan (opsional)',
            onInput: (e) => update({ detail: e.target.value }),
          }),
        ),
      ));
    });

    return wrap;
  },

  /* 4 ── keyvalue ─────────────────────────────────────────── */
  // config.fields carries inputMode, suffix, placeholder, pattern.
  // This is what lets a generic component produce a purpose-built
  // numeric BP field without a bespoke component.
  keyvalue(section, value, onChange) {
    const v = value || {};
    const wrap = el('div');

    for (const f of section.config?.fields || []) {
      const input = el('input', {
        value: v[f.key] ?? '',
        placeholder: f.placeholder || '',
        inputmode: f.inputMode || null,
        pattern: f.pattern || null,
        onInput: (e) => onChange({ ...v, [f.key]: e.target.value }),
      });

      const control = f.suffix
        ? el('div', { style: 'display:flex;align-items:center;gap:8px' },
            input, el('span', { class: 'small faint', style: 'flex:none', text: f.suffix }))
        : input;

      wrap.append(fieldWrap(f.label, control));
    }
    return wrap;
  },

  /* 5 ── lines ────────────────────────────────────────────── */
  lines(section, value, onChange) {
    const rows = value || [];
    const wrap = el('div');

    rows.forEach((row, i) => {
      wrap.append(fieldWrap(row.label,
        el('input', {
          value: row.value || '',
          onInput: (e) => {
            onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)));
          },
        }),
      ));
    });
    return wrap;
  },

  /* 6 ── dated-repeat ─────────────────────────────────────── */
  // ⚠️ Virtual. Stores nothing on the entry. It edits the entry's
  // includedInvestigationIds against the PATIENT's master list.
  // Hard requirement #4: references, never copies.
  'dated-repeat'(section, _value, _onChange, ctx) {
    const patient = ctx?.patient;
    const entry = ctx?.entry;
    const master = [...(patient?.investigations || [])]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    if (!master.length) {
      return el('div', { class: 'empty' },
        el('p', { class: 'small', text: 'Belum ada pemeriksaan pada pasien ini.' }),
        el('p', { class: 'small faint', text: 'Tambahkan lewat halaman pasien → Pemeriksaan penunjang.' }),
      );
    }

    const selected = new Set(entry?.includedInvestigationIds || []);
    const wrap = el('div');

    wrap.append(el('div', { class: 'small faint', style: 'margin-bottom:8px' },
      `Pilih yang ikut dalam laporan hari ini. ${selected.size} dari ${master.length} dipilih.`));

    for (const inv of master) {
      const id = uid('chk_');
      wrap.append(el('label', { class: 'check', for: id },
        el('input', {
          type: 'checkbox', id, checked: selected.has(inv.id),
          onChange: (e) => {
            if (e.target.checked) selected.add(inv.id); else selected.delete(inv.id);
            ctx.onIncludedChange([...selected]);
          },
        }),
        el('span', {},
          el('strong', { text: [inv.type, inv.subtype].filter(Boolean).join(' ') || '(tanpa jenis)' }),
          el('span', { class: 'faint', text: ` · ${formatDateID(inv.date) || 'tanpa tanggal'}` }),
          inv.location && el('span', { class: 'faint', text: ` · ${inv.location}` }),
          el('div', { class: 'small faint', text: summarise(inv) }),
        ),
      ));
    }
    return wrap;
  },

  /* 7 ── flagged-values ───────────────────────────────────── */
  'flagged-values'(section, value, onChange) {
    let rows = [...(value || [])];
    const wrap = el('div');
    const commit = () => onChange([...rows]);

    function redraw(focusIndex = null) {
      clear(wrap);
      rows.forEach((row, i) => {
        const chkId = uid('fv_');
        wrap.append(el('div', { class: 'bullet-row' },
          el('input', {
            value: row.label || '', placeholder: 'parameter',
            style: 'flex:1 1 40%',
            onInput: (e) => { rows[i] = { ...rows[i], label: e.target.value }; commit(); },
          }),
          el('input', {
            value: row.value || '', placeholder: 'nilai',
            style: 'flex:1 1 30%',
            onInput: (e) => { rows[i] = { ...rows[i], value: e.target.value }; commit(); },
          }),
          el('label', { class: 'check', for: chkId, style: 'flex:none;min-height:0', title: 'Abnormal → dicetak *tebal*' },
            el('input', {
              type: 'checkbox', id: chkId, checked: !!row.abnormal,
              style: 'margin-top:0',
              onChange: (e) => { rows[i] = { ...rows[i], abnormal: e.target.checked }; commit(); },
            }),
            el('span', { class: 'small', style: 'padding-top:0', text: 'abn' }),
          ),
          iconBtn('✕', 'Hapus baris', () => { rows.splice(i, 1); commit(); redraw(); }, 'btn-danger'),
        ));
      });
      wrap.append(el('div', { class: 'btn-row' },
        el('button', {
          class: 'btn-sm', type: 'button',
          onClick: () => {
            rows.push({ label: '', value: '', abnormal: false });
            commit(); redraw(rows.length - 1);
          },
        }, '+ Tambah nilai'),
      ));
      if (focusIndex != null) wrap.querySelectorAll('input')[focusIndex * 3]?.focus();
    }

    redraw();
    return wrap;
  },

  /* 8 ── sub-blocks ───────────────────────────────────────── */
  'sub-blocks'(section, value, onChange) {
    const cfg = section.config || {};
    const titleKey = cfg.titleKey || 'dept';
    const lists = cfg.lists || [
      { key: 'assessment', label: 'A' },
      { key: 'plan', label: 'P' },
      { key: 'therapy', label: 'T' },
    ];
    let blocks = [...(value || [])];
    const wrap = el('div');
    const commit = () => onChange([...blocks]);

    function redraw() {
      clear(wrap);
      blocks.forEach((block, bi) => {
        const box = el('div', { class: 'panel', style: 'margin-bottom:10px' });
        box.append(el('div', { class: 'panel-head' },
          el('input', {
            value: block[titleKey] || '',
            placeholder: cfg.titleLabel || 'Nama blok',
            onInput: (e) => {
              blocks[bi] = { ...blocks[bi], [titleKey]: e.target.value }; commit();
            },
          }),
          iconBtn('✕', 'Hapus blok', () => { blocks.splice(bi, 1); commit(); redraw(); }, 'btn-danger'),
        ));

        for (const l of lists) {
          box.append(el('div', { class: 'field' },
            el('label', { text: l.label }),
            stringListEditor(block[l.key] || [], (next) => {
              blocks[bi] = { ...blocks[bi], [l.key]: next }; commit();
            }),
          ));
        }
        wrap.append(box);
      });

      wrap.append(el('div', { class: 'btn-row' },
        el('button', {
          class: 'btn-sm', type: 'button',
          onClick: () => {
            const fresh = { [titleKey]: '' };
            for (const l of lists) fresh[l.key] = [''];
            blocks.push(fresh); commit(); redraw();
          },
        }, '+ Tambah blok'),
      ));
    }

    redraw();
    return wrap;
  },

  /* 9 ── formula ──────────────────────────────────────────── */
  formula(section, value, onChange) {
    const v = value || { selected: '', sentence: '' };
    const opts = section.config?.options || [];
    const wrap = el('div');

    const sentenceBox = el('textarea', {
      rows: 2,
      placeholder: 'Kalimat yang muncul di laporan',
      onInput: (e) => onChange({ ...v, sentence: e.target.value }),
    }, v.sentence || '');

    wrap.append(fieldWrap('Pilihan',
      el('select', {
        onChange: (e) => {
          const opt = opts.find(o => o.value === e.target.value);
          const sentence = opt ? (opt.sentence || opt.label) : '';
          sentenceBox.value = sentence;
          onChange({ selected: e.target.value, sentence });
        },
      },
        el('option', { value: '' }, '—'),
        ...opts.map(o => el('option', { value: o.value, selected: v.selected === o.value }, o.label)),
      ),
    ));

    wrap.append(fieldWrap('Kalimat', sentenceBox,
      'Bisa diubah bebas. Kalimat inilah yang dirender.'));
    return wrap;
  },
};

function summarise(inv) {
  if (inv.values?.length) {
    return inv.values.slice(0, 3)
      .map(v => `${v.label}: ${v.value}${v.abnormal ? ' *' : ''}`).join(' · ')
      + (inv.values.length > 3 ? ` · +${inv.values.length - 3} lain` : '');
  }
  const c = String(inv.content || '').trim().replace(/\s+/g, ' ');
  return c.length > 90 ? `${c.slice(0, 90)}…` : c;
}

/* ═══════════════════════════════════════════════════════════
   THE DISPATCH LOOP
   The SOAP editor calls this once per template section. It is
   the only place that maps a section type to a UI, and it is
   exhaustive over the registry.
   ═══════════════════════════════════════════════════════════ */

export function renderSectionEditor(section, value, onChange, ctx) {
  const editor = EDITORS[section.type];

  if (!editor) {
    // A template referencing a primitive this build doesn't have —
    // e.g. an export from a newer version. Fail visibly and keep
    // the stored value untouched.
    return el('div', { class: 'notice notice-warn' },
      `Tipe bagian "${section.type}" tidak dikenal di versi ini. `
      + 'Data tersimpan tidak diubah.');
  }

  const t = getType(section.type);
  const node = editor(section, t.normalize(value, section.config), onChange, ctx);

  return el('div', { class: 'panel', dataset: { sectionKey: section.key } },
    el('div', { class: 'panel-head' },
      el('h3', { text: section.label || section.key }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'chip', title: 'Kunci bagian — dipakai di template', text: section.key }),
    ),
    node,
  );
}

export { stringListEditor };

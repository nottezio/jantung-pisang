// ─────────────────────────────────────────────────────────────
//  INVESTIGATIONS — the patient's MASTER list.
//
//  Hard requirement #4. One day's report cites studies spanning
//  weeks. They live here, on the patient, for the whole
//  admission. A SOAP entry stores only references.
// ─────────────────────────────────────────────────────────────
import { el, clear, clone, formatDateID, toast } from '../util.js';
import { BLANK_INVESTIGATION, saveInvestigation, deleteInvestigation } from '../store.js';
import { openDialog, confirmDialog } from './shell.js';
import { INVESTIGATION_TYPES } from '../seed.js';

export function investigationList(patient, onChanged) {
  const wrap = el('div');

  function draw() {
    clear(wrap);
    const list = [...(patient.investigations || [])]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    wrap.append(el('div', { class: 'panel-head' },
      el('h3', { text: 'Pemeriksaan penunjang' }),
      el('span', { class: 'chip', text: String(list.length) }),
      el('span', { class: 'spacer' }),
      el('button', {
        class: 'btn-sm',
        onClick: () => openInvestigationForm(patient, null, refresh),
      }, '+ Tambah'),
    ));

    if (!list.length) {
      wrap.append(el('div', { class: 'empty' },
        el('p', { class: 'small', text: 'Belum ada pemeriksaan.' }),
        el('p', { class: 'small faint',
          text: 'Ditambahkan sekali di sini, lalu tinggal dicentang di setiap SOAP.' }),
      ));
      return;
    }

    for (const inv of list) {
      wrap.append(el('div', { class: 'list-row' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', {},
            el('strong', { text: [inv.type, inv.subtype].filter(Boolean).join(' ') || '(tanpa jenis)' }),
            el('span', { class: 'faint small', text: ` · ${formatDateID(inv.date) || 'tanpa tanggal'}` }),
            inv.location && el('span', { class: 'faint small', text: ` · ${inv.location}` }),
          ),
          el('div', { class: 'small faint', style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
            text: summarise(inv) }),
        ),
        el('button', {
          class: 'btn-sm btn-ghost',
          onClick: () => openInvestigationForm(patient, inv, refresh),
        }, 'Ubah'),
        el('button', {
          class: 'btn-sm btn-ghost btn-danger',
          onClick: async () => {
            const ok = await confirmDialog('Hapus pemeriksaan',
              `Hapus ${inv.type || 'pemeriksaan'} ${formatDateID(inv.date)}? `
              + 'SOAP lama yang mengutipnya akan berhenti menampilkannya.');
            if (!ok) return;
            patient.investigations = await deleteInvestigation(patient, inv.id);
            toast('Pemeriksaan dihapus');
            refresh();
          },
        }, 'Hapus'),
      ));
    }
  }

  function refresh() { draw(); onChanged?.(); }
  draw();
  return wrap;
}

function summarise(inv) {
  if (inv.values?.length) {
    return inv.values.map(v => `${v.label}: ${v.value}${v.abnormal ? '*' : ''}`).join(' · ');
  }
  return String(inv.content || '').replace(/\s+/g, ' ').trim() || '—';
}

/* ── Add / edit one investigation ───────────────────────────── */

export function openInvestigationForm(patient, existing, onSaved) {
  const inv = existing ? clone(existing) : BLANK_INVESTIGATION();
  const { body, foot, close } = openDialog(existing ? 'Ubah pemeriksaan' : 'Pemeriksaan baru');

  const typeInput = el('input', {
    value: inv.type || '', list: 'invTypes', placeholder: 'EKG, Laboratorium, …',
    onInput: (e) => { inv.type = e.target.value; },
  });

  body.append(
    el('datalist', { id: 'invTypes' }, ...INVESTIGATION_TYPES.map(t => el('option', { value: t }))),
    el('div', { class: 'field' }, el('label', { text: 'Jenis' }), typeInput),
    el('div', { class: 'field-row' },
      el('div', { class: 'field' }, el('label', { text: 'Sub-jenis' }),
        el('input', { value: inv.subtype || '', placeholder: 'opsional',
          onInput: (e) => { inv.subtype = e.target.value; } })),
      el('div', { class: 'field' }, el('label', { text: 'Lokasi' }),
        el('input', { value: inv.location || '', placeholder: 'RSWS, luar, …',
          onInput: (e) => { inv.location = e.target.value; } })),
    ),
    el('div', { class: 'field' }, el('label', { text: 'Tanggal' }),
      el('input', { type: 'date', value: inv.date || '',
        onInput: (e) => { inv.date = e.target.value; } })),
    el('div', { class: 'field' },
      el('label', { text: 'Isi / kesan' }),
      el('textarea', { rows: 5,
        onInput: (e) => { inv.content = e.target.value; } }, inv.content || ''),
      el('div', { class: 'small faint',
        text: 'Nilai terstruktur dengan tanda abnormal menyusul di Fase 2.' }),
    ),
  );

  const err = el('div', { class: 'notice notice-warn', hidden: true, style: 'margin:0 16px' });
  foot.before(err);

  const btn = el('button', { class: 'btn-primary', onClick: save }, 'Simpan');
  foot.append(el('button', { onClick: close }, 'Batal'), btn);

  async function save() {
    if (!String(inv.type || '').trim() && !String(inv.content || '').trim()) {
      err.textContent = 'Isi minimal jenis atau isi pemeriksaan.'; err.hidden = false; return;
    }
    err.hidden = true; btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      patient.investigations = await saveInvestigation(patient, inv);
      close();
      toast(existing ? 'Pemeriksaan diperbarui' : 'Pemeriksaan ditambahkan');
      onSaved?.();
    } catch (ex) {
      err.textContent = `Gagal menyimpan: ${ex?.message || ex}`;
      err.hidden = false; btn.disabled = false; btn.textContent = 'Simpan';
    }
  }
}

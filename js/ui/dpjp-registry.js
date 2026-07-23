// ─────────────────────────────────────────────────────────────
//  DPJP REGISTRY
//
//  Selecting a DPJP surfaces how to report to them — channel, PDF
//  requirement, caveats — without re-asking every time.
//
//  ⛔ Hard requirement #2: no credential field, ever. mrDays and
//     notes are free text; if a system login must be referenced,
//     a username-only convention belongs in `notes`, never a
//     structured password field.
// ─────────────────────────────────────────────────────────────
import { el, clear, clone, toast } from '../util.js';
import { listDpjp, saveDpjp, deleteDpjp, BLANK_DPJP } from '../store.js';
import { mount, loading, showError, openDialog, confirmDialog } from './shell.js';
import { REPORT_CHANNELS } from '../seed.js';
import { navigate } from '../app.js';

const channelLabel = (v) => REPORT_CHANNELS.find(c => c.value === v)?.label || v;

export async function renderDpjpRegistry() {
  loading('Memuat daftar DPJP…');
  let list;
  try {
    list = await listDpjp();
  } catch (err) {
    return showError('Gagal memuat daftar DPJP.', `${err?.code || ''} ${err?.message || ''}`);
  }
  draw(list);
}

function draw(list) {
  const toolbar = el('div', { class: 'toolbar' },
    el('h2', { style: 'flex:1', text: `${list.length} DPJP` }),
    el('button', {
      class: 'btn-primary',
      onClick: () => openDpjpForm(null, () => renderDpjpRegistry()),
    }, '+ DPJP baru'),
  );

  const back = el('button', {
    class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
    onClick: () => navigate({ route: 'patients' }),
  }, '← Daftar pasien');

  const body = list.length
    ? el('div', {}, ...list.map(dpjpRow))
    : el('div', { class: 'empty' },
        el('h3', { text: 'Belum ada DPJP tersimpan' }),
        el('p', { class: 'small', text:
          'Tambahkan DPJP untuk mengingat cara melapor ke masing-masing — '
          + 'lewat Chief, PDF, atau langsung PC.' }),
      );

  mount(el('div', {}, back, toolbar, body));
}

function dpjpRow(d) {
  return el('div', { class: 'panel', style: 'margin-bottom:10px' },
    el('div', { class: 'panel-head' },
      el('div', { style: 'flex:1;min-width:0' },
        el('div', {},
          el('strong', { text: d.name || '(tanpa nama)' }),
          d.initial ? el('span', { class: 'faint small', text: ` (${d.initial})` }) : null,
        ),
        d.titles ? el('div', { class: 'small faint', text: d.titles }) : null,
      ),
      el('button', { class: 'btn-sm btn-ghost',
        onClick: () => openDpjpForm(d, () => renderDpjpRegistry()) }, 'Ubah'),
      el('button', { class: 'btn-sm btn-ghost btn-danger',
        onClick: async () => {
          const ok = await confirmDialog('Hapus DPJP', `Hapus ${d.name} dari daftar?`);
          if (!ok) return;
          await deleteDpjp(d.id);
          toast('DPJP dihapus');
          renderDpjpRegistry();
        } }, 'Hapus'),
    ),
    el('div', { class: 'pt-foot' },
      el('span', { class: 'chip chip-accent', text: channelLabel(d.reportChannel) }),
      d.needsPDF ? el('span', { class: 'chip', text: 'Perlu PDF' }) : null,
      (d.mrDays || []).length
        ? el('span', { class: 'chip', text: `MR: ${d.mrDays.join(', ')}` })
        : null,
    ),
    d.notes ? el('div', { class: 'small', style: 'margin-top:8px', text: d.notes }) : null,
  );
}

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function openDpjpForm(existing, onSaved) {
  const isNew = !existing;
  const d = existing ? clone(existing) : BLANK_DPJP();
  const { body, foot, close } = openDialog(isNew ? 'DPJP baru' : 'Ubah DPJP');

  const field = (label, key, opts = {}) => el('div', { class: 'field' },
    el('label', { text: label }),
    el('input', {
      value: d[key] || '', placeholder: opts.placeholder || '',
      onInput: (e) => { d[key] = e.target.value; },
    }),
  );

  body.append(
    field('Nama', 'name', { placeholder: 'dr. A, Sp.JP' }),
    el('div', { class: 'field-row' },
      field('Inisial', 'initial', { placeholder: 'A' }),
      el('div', { class: 'field' },
        el('label', { text: 'Cara lapor' }),
        el('select', { onChange: (e) => { d.reportChannel = e.target.value; } },
          ...REPORT_CHANNELS.map(c =>
            el('option', { value: c.value, selected: d.reportChannel === c.value }, c.label)),
        ),
      ),
    ),
    field('Gelar / jabatan', 'titles', { placeholder: 'opsional' }),

    el('label', { class: 'check' },
      el('input', { type: 'checkbox', checked: !!d.needsPDF,
        onChange: (e) => { d.needsPDF = e.target.checked; } }),
      el('span', { text: 'Perlu laporan dalam bentuk PDF' }),
    ),

    el('div', { class: 'field' },
      el('label', { text: 'Hari MR (jika ada)' }),
      el('div', { class: 'btn-row' },
        ...HARI.map(h => {
          const on = (d.mrDays || []).includes(h);
          return el('button', {
            type: 'button', class: 'btn-sm ' + (on ? 'btn-primary' : ''),
            onClick: (e) => {
              d.mrDays = d.mrDays || [];
              const i = d.mrDays.indexOf(h);
              if (i >= 0) d.mrDays.splice(i, 1); else d.mrDays.push(h);
              e.target.classList.toggle('btn-primary', d.mrDays.includes(h));
            },
          }, h);
        }),
      ),
    ),

    el('div', { class: 'field' },
      el('label', { text: 'Catatan' }),
      el('textarea', { rows: 3, placeholder: 'mis. jangan di-chat, tidak membalas cepat…',
        onInput: (e) => { d.notes = e.target.value; } }, d.notes || ''),
      el('div', { class: 'small faint',
        text: '⛔ Jangan simpan kata sandi atau kredensial apa pun di sini.' }),
    ),
  );

  const err = el('div', { class: 'notice notice-warn', hidden: true, style: 'margin:0 16px' });
  foot.before(err);

  const saveBtn = el('button', { class: 'btn-primary', onClick: save }, 'Simpan');
  foot.append(el('button', { onClick: close }, 'Batal'), saveBtn);

  async function save() {
    if (!String(d.name || '').trim()) {
      err.textContent = 'Nama wajib diisi.'; err.hidden = false; return;
    }
    err.hidden = true; saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan…';
    try {
      await saveDpjp(d);
      close();
      toast(isNew ? 'DPJP ditambahkan' : 'DPJP disimpan');
      onSaved?.();
    } catch (ex) {
      err.textContent = `Gagal menyimpan: ${ex?.code || ex?.message || ex}`;
      err.hidden = false; saveBtn.disabled = false; saveBtn.textContent = 'Simpan';
    }
  }
}

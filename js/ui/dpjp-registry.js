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
import { openDialog, confirmDialog } from './shell.js';
import { REPORT_CHANNELS, DPJP_SEED } from '../seed.js';

const channelLabel = (v) => REPORT_CHANNELS.find(c => c.value === v)?.label || v;

let HOST = null;

/** Render the registry into a host element (used by the Manager tab). */
export async function dpjpPanel(host) {
  if (host) HOST = host;
  if (!HOST) return;
  HOST.replaceChildren(el('p', { class: 'muted', text: 'Memuat daftar DPJP…' }));
  let list;
  try {
    list = await listDpjp();
  } catch (err) {
    HOST.replaceChildren(el('div', { class: 'notice notice-warn' },
      `Gagal memuat daftar DPJP: ${err?.code || err?.message || err}`));
    return;
  }
  draw(list);
}

export const renderDpjpRegistry = () => dpjpPanel();

function draw(list) {
  const toolbar = el('div', { class: 'toolbar' },
    el('h2', { style: 'flex:1', text: `${list.length} DPJP` }),
    list.length === 0 ? el('button', {
      onClick: async () => {
        const ok = await confirmDialog('Isi daftar awal',
          `Tambahkan ${DPJP_SEED.length} DPJP dari daftar?\n\n`
          + 'Cara lapor untuk 10 DPJP sudah diketahui; sisanya diisi '
          + '"Lewat Chief" dan ditandai "?" sampai dikonfirmasi.',
          'Tambahkan');
        if (!ok) return;
        try {
          for (const d of DPJP_SEED) {
            await saveDpjp({ ...BLANK_DPJP(), ...d });
          }
          toast(`${DPJP_SEED.length} DPJP ditambahkan`);
          renderDpjpRegistry();
        } catch (ex) {
          toast(`Gagal: ${ex?.code || ex?.message || ex}`);
        }
      },
    }, 'Isi daftar awal') : null,
    el('button', {
      class: 'btn-primary',
      onClick: () => openDpjpForm(null, () => renderDpjpRegistry()),
    }, '+ DPJP baru'),
  );

  const rows = el('div', { class: 'dpjp-list' }, ...list.map(dpjpRow));
  const search = el('input', {
    type: 'search', placeholder: 'Cari nama atau inisial…',
    style: 'margin-bottom:10px',
    onInput: (e) => {
      const q = e.target.value.trim().toLowerCase();
      rows.replaceChildren(...list
        .filter(d => !q
          || (d.name || '').toLowerCase().includes(q)
          || (d.initial || '').toLowerCase().includes(q))
        .map(dpjpRow));
    },
  });

  const body = list.length
    ? el('div', {}, list.length > 8 ? search : null, rows)
    : el('div', { class: 'empty' },
        el('h3', { text: 'Belum ada DPJP tersimpan' }),
        el('p', { class: 'small', text:
          'Tambahkan DPJP untuk mengingat cara melapor ke masing-masing — '
          + 'lewat Chief, PDF, atau langsung PC.' }),
        el('p', { class: 'small faint', text:
          '"Isi daftar awal" menambahkan 24 DPJP beserta inisialnya. '
          + 'Cara lapor yang belum dikonfirmasi ditandai dengan "?".' }),
      );

  HOST.replaceChildren(toolbar, body);
}

const CHANNEL_SHORT = {
  viaChief: 'Chief', viaChiefPDF: 'Chief+PDF',
  pcAndGrup: 'PC+Grup', pcOnly: 'PC',
};

/* One line per DPJP. A 24-row registry read on a phone during
   rounds is a lookup, not a browse — density beats decoration. */
function dpjpRow(d) {
  const unconfirmed = d.channelKnown === false;
  return el('div', { class: 'dpjp-row' },
    el('span', { class: 'dpjp-ini', text: d.initial || '?' }),
    el('span', { class: 'dpjp-name', title: d.name || '', text: d.name || '(tanpa nama)' }),
    el('span', {
      class: 'chip' + (unconfirmed ? '' : ' chip-accent'),
      style: 'flex:none',
      title: unconfirmed ? 'Cara lapor belum dikonfirmasi' : channelLabel(d.reportChannel),
      text: (CHANNEL_SHORT[d.reportChannel] || d.reportChannel) + (unconfirmed ? '?' : ''),
    }),
    d.needsPDF ? el('span', { class: 'chip', style: 'flex:none', text: 'PDF' }) : null,
    el('button', { class: 'btn-sm btn-ghost', style: 'flex:none',
      onClick: () => openDpjpForm(d, () => renderDpjpRegistry()) }, 'Ubah'),
    el('button', { class: 'btn-sm btn-ghost btn-danger', style: 'flex:none',
      onClick: async () => {
        const ok = await confirmDialog('Hapus DPJP', `Hapus ${d.name || d.initial}?`);
        if (!ok) return;
        await deleteDpjp(d.id);
        toast('DPJP dihapus');
        renderDpjpRegistry();
      } }, '✕'),
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

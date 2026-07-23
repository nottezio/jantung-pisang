// ─────────────────────────────────────────────────────────────
//  FORMAT LIBRARY
//
//  Deliberately NOT a template engine. These are blank report
//  formats the user copies by hand and fills in elsewhere. No
//  mustache, no patient data, no rendering — paste in, copy out.
//
//  Kept dumb on purpose: the moment a format needs a {{tag}}, it
//  belongs in Pengaturan as a real template instead.
//
//  Stored inside the settings document rather than its own
//  collection, so adding formats never requires a rules change.
// ─────────────────────────────────────────────────────────────
import { el, clear, copyText, toast, uid, stripWaMarkup } from '../util.js';
import { openDialog, confirmDialog } from './shell.js';
import { saveSettings } from '../store.js';
import { formattedBox } from './formatted-box.js';

export function openFormatLibrary(ctx) {
  const { body, foot, close } = openDialog('Format laporan', { wide: true });
  const list = [...(ctx.settings?.formats || [])];

  const listPane = el('div');
  const viewPane = el('div', { style: 'margin-top:12px' });

  function persist() {
    ctx.settings.formats = list;
    saveSettings(ctx.settings).catch(err => {
      toast(`Gagal menyimpan: ${err?.message || err}`);
    });
  }

  function drawList() {
    clear(listPane);

    if (!list.length) {
      listPane.append(el('div', { class: 'empty' },
        el('p', { class: 'small', text: 'Belum ada format tersimpan.' }),
        el('p', { class: 'small faint',
          text: 'Tempel format laporan kosong di sini, lalu tinggal disalin '
              + 'kapan pun dibutuhkan.' }),
      ));
    }

    for (const f of list) {
      listPane.append(el('div', { class: 'list-row' },
        el('button', {
          class: 'btn-ghost',
          style: 'flex:1;min-width:0;justify-content:flex-start;text-align:left',
          onClick: () => showFormat(f),
        }, f.name || '(tanpa nama)'),
        el('button', {
          class: 'btn-sm btn-ghost',
          onClick: () => openEditor(f),
        }, 'Ubah'),
        el('button', {
          class: 'btn-sm btn-ghost btn-danger',
          onClick: async () => {
            const ok = await confirmDialog('Hapus format', `Hapus "${f.name}"?`);
            if (!ok) return;
            const i = list.findIndex(x => x.id === f.id);
            if (i >= 0) list.splice(i, 1);
            persist(); drawList(); clear(viewPane);
          },
        }, '✕'),
      ));
    }

    listPane.append(el('div', { class: 'btn-row', style: 'margin-top:10px' },
      el('button', { class: 'btn-sm', onClick: () => openEditor(null) },
        '+ Tambah format'),
    ));
  }

  function showFormat(f) {
    clear(viewPane);

    const fb = formattedBox({
      value: f.body || '',
      minHeight: '300px',
      label: `Format ${f.name}`,
    });
    const box = fb.textView;

    async function doCopy(btn, transform, msg) {
      const ok = await copyText(transform(box.value));
      if (ok) {
        const original = btn.textContent;
        btn.textContent = '✓ Tersalin';
        toast(msg);
        setTimeout(() => { btn.textContent = original; }, 2000);
      } else {
        toast('Gagal menyalin. Pilih teksnya lalu salin manual.');
        box.select();
      }
    }

    const plainBtn = el('button', {
      title: 'Tanpa *tebal* dan _miring_',
      onClick: () => doCopy(plainBtn, stripWaMarkup, 'Disalin tanpa format'),
    }, 'Salin polos');

    const waBtn = el('button', {
      class: 'btn-primary',
      onClick: () => doCopy(waBtn, (v) => v, 'Disalin'),
    }, 'Salin WA');

    viewPane.append(
      el('div', { class: 'panel-head' },
        el('h3', { text: f.name }),
        el('span', { class: 'spacer' }),
      ),
      el('div', { class: 'small faint', style: 'margin-bottom:8px',
        text: 'Boleh diubah di sini sebelum disalin. Perubahan tidak tersimpan.' }),
      fb.node,
      el('div', { class: 'btn-row', style: 'margin-top:10px' },
        plainBtn, waBtn),
    );
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function openEditor(existing) {
    const isNew = !existing;
    const draft = existing
      ? { ...existing }
      : { id: uid('fmt_'), name: '', body: '' };

    const d = openDialog(isNew ? 'Format baru' : 'Ubah format', { wide: true });

    const nameInput = el('input', {
      value: draft.name,
      placeholder: 'mis. Lapor Chief · Lapor DPJP · Konsul',
      onInput: (e) => { draft.name = e.target.value; },
    });

    const bodyFb = formattedBox({
      value: draft.body,
      minHeight: '320px',
      label: 'Isi format',
      placeholder: 'Tempel format laporan kosong di sini…',
      onInput: (v) => { draft.body = v; },
    });
    const bodyInput = bodyFb.node;

    d.body.append(
      el('div', { class: 'field' }, el('label', { text: 'Nama format' }), nameInput),
      el('div', { class: 'field' },
        el('label', { text: 'Isi format' }),
        bodyInput,
        el('div', { class: 'small faint',
          text: 'Teks biasa. Tidak ada pengisian otomatis — ini hanya disimpan '
              + 'apa adanya untuk disalin manual.' }),
      ),
    );

    d.foot.append(
      el('button', { onClick: d.close }, 'Batal'),
      el('button', {
        class: 'btn-primary',
        onClick: () => {
          if (!String(draft.name || '').trim()) {
            draft.name = 'Tanpa nama';
          }
          const i = list.findIndex(x => x.id === draft.id);
          if (i >= 0) list[i] = draft; else list.push(draft);
          persist();
          d.close();
          drawList();
          showFormat(draft);
          toast(isNew ? 'Format ditambahkan' : 'Format disimpan');
        },
      }, 'Simpan'),
    );

    nameInput.focus();
  }

  drawList();
  body.append(
    el('p', { class: 'small faint', style: 'margin-top:0' },
      'Format kosong untuk disalin manual. Tidak terhubung dengan data pasien.'),
    listPane,
    viewPane,
  );
  foot.append(el('button', { onClick: close }, 'Tutup'));
}

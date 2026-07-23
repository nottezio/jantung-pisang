// ─────────────────────────────────────────────────────────────
//  SOAP REFORMATTER — standalone
//
//  Take a note in one shape, produce it in another. Not tied to a
//  patient, not tied to a transfer: paste anything in, pick a
//  target format, move the text across.
//
//  ⛔ No automatic field mapping, deliberately. Two reports of the
//     same patient on the same day differ by more than layout —
//     therapy that finished, investigations added, plans changed.
//     An automatic transform emits a complete-looking report
//     carrying stale orders. The app puts source and target
//     side by side; the doctor decides what is still true.
// ─────────────────────────────────────────────────────────────
import { el, clear, copyText, toast, stripWaMarkup } from '../util.js';
import { listPatients, listEntries } from '../store.js';
import { mount, loading, showError } from './shell.js';
import { navigate } from '../app.js';

let CTX = null;

export async function renderReformat(ctx) {
  if (ctx) CTX = ctx;
  loading('Menyiapkan…');
  let patients = [];
  try {
    patients = (await listPatients()).filter(p => !p.disposition);
  } catch (err) {
    // A failed patient list is not fatal — manual paste still works.
    console.warn('[reformat] patient list unavailable:', err?.code);
  }
  draw(patients);
}

function draw(patients) {
  const formats = CTX?.settings?.formats || [];

  /* ── Source pane ── */
  const sourceBox = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    style: 'min-height:420px',
    placeholder: 'Tempel catatan lama di sini, atau ambil dari pasien di atas…',
    'aria-label': 'Catatan sumber',
  }, '');

  const patientPicker = el('select', {
    'aria-label': 'Ambil dari pasien',
    onChange: async (e) => {
      const id = e.target.value;
      if (!id) return;
      if (sourceBox.value.trim()
          && !confirm('Ganti isi sumber dengan catatan pasien ini?')) {
        e.target.value = '';
        return;
      }
      sourceBox.value = 'Memuat…';
      try {
        const entries = await listEntries(id);
        const latest = entries[0];
        sourceBox.value = latest
          ? String(latest.sections?.note ?? '')
          : '(pasien ini belum punya catatan)';
      } catch (err) {
        sourceBox.value = `(gagal memuat: ${err?.code || err?.message})`;
      }
    },
  },
    el('option', { value: '' }, patients.length ? '— ambil dari pasien —' : '(tidak ada pasien)'),
    ...patients.map(p => el('option', { value: p.id },
      `${p.name || '(tanpa nama)'}${p.location?.room ? ` · ${p.location.room}` : ''}`)),
  );

  const left = el('div', { class: 'sbs-pane' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Sumber' }),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn-sm btn-ghost',
        onClick: () => { sourceBox.value = ''; sourceBox.focus(); } }, 'Bersihkan'),
    ),
    patients.length ? el('div', { class: 'field' }, patientPicker) : null,
    sourceBox,
  );

  /* ── Target pane ── */
  const targetBox = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    style: 'min-height:420px',
    placeholder: formats.length
      ? 'Pilih format di atas, lalu susun dari sumber di kiri…'
      : 'Belum ada format tersimpan. Tambahkan lewat menu Format.',
    'aria-label': 'Format tujuan',
  }, '');

  const formatPicker = el('select', {
    'aria-label': 'Pilih format tujuan',
    onChange: (e) => {
      const f = formats.find(x => x.id === e.target.value);
      if (!f) return;
      if (targetBox.value.trim()
          && !confirm('Ganti isi kanan dengan format ini? Isi sekarang akan hilang.')) {
        e.target.value = '';
        return;
      }
      targetBox.value = f.body || '';
    },
  },
    el('option', { value: '' }, formats.length ? '— pilih format —' : '(belum ada format)'),
    ...formats.map(f => el('option', { value: f.id }, f.name || '(tanpa nama)')),
  );

  async function doCopy(btn, transform, msg) {
    const ok = await copyText(transform(targetBox.value));
    if (ok) {
      const original = btn.textContent;
      btn.textContent = '✓ Tersalin';
      toast(msg);
      setTimeout(() => { btn.textContent = original; }, 2000);
    } else {
      toast('Gagal menyalin. Pilih teksnya lalu salin manual.');
      targetBox.select();
    }
  }

  const plainBtn = el('button', {
    title: 'Tanpa *tebal* dan _miring_ — untuk SIMGOS',
    onClick: () => doCopy(plainBtn, stripWaMarkup, 'Disalin tanpa format'),
  }, 'Salin polos');

  const waBtn = el('button', {
    class: 'btn-primary',
    onClick: () => doCopy(waBtn, (v) => v, 'Disalin — siap ditempel'),
  }, 'Salin WA');

  const right = el('div', { class: 'sbs-pane' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Hasil' }),
      el('span', { class: 'spacer' }),
    ),
    el('div', { class: 'field' }, formatPicker),
    targetBox,
    el('div', { class: 'btn-row', style: 'margin-top:8px' }, plainBtn, waBtn),
  );

  mount(el('div', {},
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),

    el('h2', { text: 'Ubah format' }),
    el('p', { class: 'small faint', style: 'margin-top:0' },
      'Sorot bagian yang dibutuhkan di kiri, salin, tempel di kanan. '
      + 'Tidak ada pemindahan otomatis — periksa sendiri terapi yang sudah '
      + 'selesai, pemeriksaan baru, dan rencana yang berubah.'),

    el('div', { class: 'sbs' }, left, right),
  ));

  if (formats.length === 1) {
    formatPicker.value = formats[0].id;
    targetBox.value = formats[0].body || '';
  }
}

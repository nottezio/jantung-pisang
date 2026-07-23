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
import { reformat, LAYOUTS } from '../reformat-engine.js';
import { formattedBox } from './formatted-box.js';
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
  const srcFb = formattedBox({
    value: '',
    minHeight: '420px',
    label: 'Catatan sumber',
    placeholder: 'Tempel catatan lama di sini, atau ambil dari pasien di atas…',
  });
  const sourceBox = srcFb.textView;

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
      srcFb.set('Memuat…');
      try {
        const entries = await listEntries(id);
        const latest = entries[0];
        srcFb.set(latest
          ? String(latest.sections?.note ?? '')
          : '(pasien ini belum punya catatan)');
      } catch (err) {
        srcFb.set(`(gagal memuat: ${err?.code || err?.message})`);
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
        onClick: () => { srcFb.set(''); srcFb.setRendered(false); srcFb.focus(); } }, 'Bersihkan'),
    ),
    patients.length ? el('div', { class: 'field' }, patientPicker) : null,
    srcFb.node,
  );

  /* ── Target pane ── */
  const tgtFb = formattedBox({
    value: '',
    minHeight: '420px',
    label: 'Hasil',
    placeholder: formats.length
      ? 'Pilih format di atas, lalu susun dari sumber di kiri…'
      : 'Belum ada format tersimpan. Tambahkan lewat menu Format.',
  });
  const targetBox = tgtFb.textView;

  /* ── Automatic transform ──────────────────────────────────
     Moves recognised blocks into the target layout. Everything it
     emits came from the source; anything it cannot classify is
     appended under a warning heading rather than dropped. */
  const layoutPicker = el('select', {
    'aria-label': 'Format tujuan otomatis',
    style: 'flex:1',
  }, ...Object.values(LAYOUTS).map(l =>
    el('option', { value: l.id, selected: l.id === 'bangsal' }, l.name)));

  const report = el('div', { class: 'small faint', style: 'margin-top:6px' });

  const autoBtn = el('button', {
    class: 'btn-primary',
    onClick: () => {
      const src = sourceBox.value.trim();
      if (!src) { toast('Isi dulu catatan sumber di kiri.'); sourceBox.focus(); return; }
      const r = reformat(src, layoutPicker.value);
      tgtFb.set(r.text);
      const bits = [`${r.placed} blok dipindahkan`];
      if (r.dropped.length) bits.push(`${r.dropped.length} tidak disertakan`);
      if (r.unplaced.length) bits.push(`${r.unplaced.length} belum ditempatkan`);
      report.textContent = bits.join(' · ') + ' — periksa hasilnya sebelum disalin.';
      report.style.color = r.unplaced.length ? 'var(--stage-early)' : '';
      targetBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  }, '⇄ Ubah otomatis');

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
      tgtFb.set(f.body || '');
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
    el('div', { class: 'panel', style: 'padding:10px;margin-bottom:10px' },
      el('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px',
        text: 'Ubah otomatis' }),
      el('div', { style: 'display:flex;gap:8px;align-items:center' },
        layoutPicker, autoBtn),
      report,
    ),
    el('div', { class: 'field' },
      el('div', { class: 'small faint', style: 'margin-bottom:4px',
        text: 'atau mulai dari format kosong:' }),
      formatPicker),
    tgtFb.node,
    el('div', { class: 'btn-row', style: 'margin-top:8px' }, plainBtn, waBtn),
  );

  mount(el('div', {},
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),

    el('h2', { text: 'Ubah format' }),
    el('p', { class: 'small faint', style: 'margin-top:0' },
      'Tempel catatan di kiri, lalu "Ubah otomatis" untuk memindahkannya '
      + 'ke susunan format lain. Isi tetap milik Anda — aplikasi hanya '
      + 'memindahkan, tidak menulis. Periksa hasilnya sebelum disalin.'),

    el('div', { class: 'sbs' }, left, right),
  ));

  if (formats.length === 1) {
    formatPicker.value = formats[0].id;
    tgtFb.set(formats[0].body || '');
  }
}

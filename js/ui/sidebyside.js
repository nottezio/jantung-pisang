// ─────────────────────────────────────────────────────────────
//  SIDE-BY-SIDE — SOAP beside a blank format
//
//  For the case where a report must be assembled by hand into a
//  format the app does not generate: source on the left, target on
//  the right, both visible at once.
//
//  No automatic mapping between the two panes. Field-matching
//  guesses would be wrong often enough to be dangerous, and
//  silently wrong is the worst failure mode for a clinical report.
//  The user moves the text; the app just stops making them switch
//  tabs to do it.
// ─────────────────────────────────────────────────────────────
import { el, clear, copyText, toast, stripWaMarkup } from '../util.js';
import { openDialog } from './shell.js';
import { renderReport } from '../render.js';

export function openSideBySide({ patient, entry, template, ctx, initialText }) {
  const { dialog, body, foot, close } = openDialog('Susun dengan format', { wide: true });
  dialog.classList.add('sbs-dialog');

  // initialText wins; entry is optional so a transfer can open this
  // view with the carried-forward note before anything is rendered.
  const soapText = initialText ?? (entry ? (() => {
    const r = renderReport({ patient, entry, template, settings: ctx.settings });
    return r.ok ? r.text : `(gagal render: ${r.error})`;
  })() : '');

  const formats = ctx.settings?.formats || [];

  /* ── Left: the SOAP, selectable ── */
  const soapBox = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    readonly: true,
    'aria-label': 'SOAP pasien',
    style: 'min-height:340px;background:var(--surface-alt)',
  }, soapText);

  const copySoap = el('button', {
    class: 'btn-sm',
    onClick: async () => {
      const ok = await copyText(soapBox.value);
      toast(ok ? 'SOAP disalin' : 'Gagal menyalin');
    },
  }, 'Salin SOAP');

  const left = el('div', { class: 'sbs-pane' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Catatan lama' }),
      el('span', { class: 'spacer' }),
      copySoap,
    ),
    soapBox,
    el('div', { class: 'small faint', style: 'margin-top:6px',
      text: 'Sorot bagian yang dibutuhkan, salin, lalu tempel di kanan.' }),
  );

  /* ── Right: the target format, editable ── */
  const targetBox = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    'aria-label': 'Format tujuan',
    style: 'min-height:340px',
    placeholder: formats.length
      ? 'Pilih format di atas, lalu isi dari SOAP di kiri…'
      : 'Belum ada format tersimpan. Tambahkan lewat menu Format.',
  }, '');

  const picker = el('select', {
    'aria-label': 'Pilih format',
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
    class: 'btn-sm',
    title: 'Tanpa *tebal* dan _miring_ — untuk SIMGOS',
    onClick: () => doCopy(plainBtn, stripWaMarkup, 'Disalin tanpa format'),
  }, 'Salin polos');

  const waBtn = el('button', {
    class: 'btn-sm btn-primary',
    onClick: () => doCopy(waBtn, (v) => v, 'Disalin — siap ditempel'),
  }, 'Salin WA');

  const right = el('div', { class: 'sbs-pane' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Format' }),
      el('span', { class: 'spacer' }),
      picker,
    ),
    targetBox,
    el('div', { class: 'btn-row', style: 'margin-top:6px' }, plainBtn, waBtn),
  );

  body.append(el('div', { class: 'sbs' }, left, right));
  foot.append(el('button', { onClick: close }, 'Tutup'));

  // Preselect when there is only one format — no reason to make a
  // choice that has one answer.
  if (formats.length === 1) {
    picker.value = formats[0].id;
    targetBox.value = formats[0].body || '';
  }
}

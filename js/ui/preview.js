// ─────────────────────────────────────────────────────────────
//  RENDER → EDITABLE PREVIEW → COPY
//
//  ⚠️ NEVER copy to clipboard without a preview step. Reality
//     always has a one-off addition. The rendered text lands in
//     an editable box; the user tweaks it; THEN copies.
//
//  Edits here are deliberately NOT saved back to the entry. They
//  are one-off wording for this message. Re-rendering tomorrow
//  starts from the stored data again.
// ─────────────────────────────────────────────────────────────
import { el, copyText, toast, stripWaMarkup } from '../util.js';
import { renderReport } from '../render.js';
import { openDialog } from './shell.js';

export function openPreview({ patient, entry, template, settings }) {
  const { body, foot, close } = openDialog('Pratinjau laporan', { wide: true });

  const result = renderReport({ patient, entry, template, settings });

  if (!result.ok) {
    body.append(
      el('div', { class: 'notice notice-warn' },
        'Template tidak dapat dirender. Data entri tidak berubah.'),
      el('pre', { class: 'small', style: 'white-space:pre-wrap' }, result.error),
      el('p', { class: 'small faint',
        text: 'Perbaiki template di Pengaturan, lalu coba lagi.' }),
    );
    foot.append(el('button', { onClick: close }, 'Tutup'));
    return;
  }

  const box = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    'aria-label': 'Teks laporan, dapat diubah sebelum disalin',
  }, result.text);

  const counter = el('div', { class: 'small faint' });
  const updateCounter = () => {
    counter.textContent = `${box.value.length} karakter`;
  };
  box.addEventListener('input', updateCounter);
  updateCounter();

  body.append(
    el('div', { class: 'small faint', style: 'margin-bottom:8px' },
      'Ubah seperlunya di sini. Perubahan hanya berlaku untuk pesan ini, '
      + 'tidak mengubah data entri.'),
    box,
    counter,
  );

  /* Two destinations, two formats. WhatsApp renders *bold*; SIMGOS
     CPPT renders the asterisks literally, so it needs them gone.
     Both copy whatever is currently in the box, including one-off
     edits made here. */
  async function doCopy(btn, transform, label, successMsg) {
    const ok = await copyText(transform(box.value));
    if (ok) {
      const original = btn.textContent;
      btn.textContent = '✓ Tersalin';
      toast(successMsg);
      setTimeout(() => { btn.textContent = original; }, 2000);
    } else {
      toast('Gagal menyalin. Pilih teksnya lalu salin manual.');
      box.select();
    }
  }

  const copyPlain = el('button', {
    title: 'Tanpa *tebal* dan _miring_ — untuk CPPT SIMGOS',
    onClick: () => doCopy(copyPlain, stripWaMarkup, 'plain',
      'Disalin tanpa format — siap untuk SIMGOS'),
  }, 'Salin polos (SIMGOS)');

  const copyWa = el('button', {
    class: 'btn-primary',
    title: 'Dengan *tebal* dan _miring_ — untuk WhatsApp',
    onClick: () => doCopy(copyWa, (v) => v, 'wa',
      'Disalin — tinggal tempel di WhatsApp'),
  }, 'Salin WA');

  foot.append(
    el('button', {
      onClick: () => { box.value = result.text; updateCounter(); },
    }, 'Kembalikan'),
    el('button', { onClick: close }, 'Tutup'),
    copyPlain,
    copyWa,
  );

  box.focus();
  box.setSelectionRange(0, 0);
}

// ─────────────────────────────────────────────────────────────
//  TRANSFER — pindah ruangan
//
//  What this DOES:
//    · records where the patient came from, so the report header
//      can say "perpindahan dari X ke Y"
//    · updates location and entryType
//    · carries the previous note forward as a starting point
//    · opens it side-by-side with the target shape
//
//  What this DELIBERATELY DOES NOT DO: rewrite the note.
//
//  A CVCU note and a bangsal note are not the same content in two
//  layouts. Comparing a real pair shows the bangsal version adds
//  EKGs, changes a therapy line ("H2" -> "H2 habis stop"), adds a
//  discharge plan, and drops whole sections. None of that is
//  derivable from the source. An automatic transform would emit a
//  complete-looking report carrying yesterday's therapy orders —
//  the exact silent-error failure the spec rules out.
//
//  So: the app moves the text next to the target and gets out of
//  the way. The doctor decides what is still true.
// ─────────────────────────────────────────────────────────────
import { el, clone, toast, isoDate, locationFull } from '../util.js';
import { transferPatient, listEntries, carryForwardEntry, createEntry } from '../store.js';
import { openDialog } from './shell.js';
import { openSideBySide } from './sidebyside.js';

export function openTransferDialog({ patient, ctx, onDone }) {
  const { body, foot, close } = openDialog('Pindah ruangan');

  const from = clone(patient.location || {});
  const to = clone(patient.location || {});
  const date = { value: isoDate() };

  const field = (label, key, opts = {}) => el('div', { class: 'field' },
    el('label', { text: label }),
    el('input', {
      value: to[key] || '',
      inputmode: opts.inputMode || null,
      placeholder: opts.placeholder || '',
      onInput: (e) => { to[key] = e.target.value; },
    }),
  );

  const makeEntry = el('input', { type: 'checkbox', checked: true });

  body.append(
    el('div', { class: 'notice notice-accent' },
      el('div', { class: 'small faint', text: 'Dari' }),
      el('strong', { text: locationFull(from) || '(lokasi belum diisi)' }),
    ),

    el('h3', { text: 'Pindah ke', style: 'margin-top:14px' }),
    el('div', { class: 'field-row' },
      field('Bangsal', 'ward', { placeholder: 'PJT' }),
      field('Lantai', 'floor', { inputMode: 'numeric' }),
    ),
    el('div', { class: 'field-row' },
      field('Kamar', 'room'),
      field('Bed', 'bed'),
    ),

    el('div', { class: 'field' },
      el('label', { text: 'Tanggal pindah' }),
      el('input', { type: 'date', value: date.value,
        onInput: (e) => { date.value = e.target.value; } }),
    ),

    el('label', { class: 'check' },
      makeEntry,
      el('span', {},
        'Buat catatan baru dari catatan terakhir',
        el('div', { class: 'small faint',
          text: 'Teks lama disalin apa adanya untuk disusun ulang — '
              + 'tidak ada yang diubah otomatis.' }),
      ),
    ),

    el('div', { class: 'notice', style: 'margin-top:10px' },
      el('strong', { class: 'small', text: 'Periksa sendiri setelah pindah:' }),
      el('div', { class: 'small faint', text:
        'terapi yang sudah selesai · pemeriksaan baru · rencana baru · '
        + 'bagian yang tidak berlaku di ruangan baru' }),
    ),
  );

  const err = el('div', { class: 'notice notice-warn', hidden: true, style: 'margin:0 16px' });
  foot.before(err);

  const saveBtn = el('button', { class: 'btn-primary', onClick: go }, 'Pindahkan');
  foot.append(el('button', { onClick: close }, 'Batal'), saveBtn);

  async function go() {
    const changed = ['ward', 'floor', 'room', 'bed'].some(k => (to[k] || '') !== (from[k] || ''));
    if (!changed) {
      err.textContent = 'Lokasi baru sama dengan lokasi sekarang.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Memindahkan…';

    try {
      await transferPatient(patient, to, date.value);

      let sourceText = '';
      if (makeEntry.checked) {
        const entries = await listEntries(patient.id);
        const latest = entries[0];
        if (latest) {
          const draft = carryForwardEntry(latest, ctx.template);
          draft.date = date.value;
          draft.reportType = 'perpindahan';
          await createEntry(draft);
          sourceText = String(draft.sections?.note ?? '');
        }
      }

      close();
      toast(`Dipindahkan ke ${locationFull(to)}`);
      onDone?.();

      if (sourceText) {
        openSideBySide({
          patient, entry: null, template: ctx.template, ctx,
          initialText: sourceText,
        });
      }
    } catch (ex) {
      err.textContent = `Gagal memindahkan: ${ex?.code || ex?.message || ex}`;
      err.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Pindahkan';
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  PENGINGAT — ordered checklists
//
//  For duties where the cost of forgetting is high and the order
//  matters: Morning Report preparation, jaga handover, and so on.
//
//  Two design choices worth stating:
//
//  · Progress resets daily, using the same date-stamp trick as the
//    stage tracker. A checklist that stays ticked from yesterday is
//    worse than no checklist, because it reads as done.
//
//  · The next unchecked step is highlighted rather than merely
//    listed. Mid-duty, the question is "what now", not "what is
//    the full set" — and steps can be ticked out of order when
//    reality demands it.
//
//  Content is DATA, stored in settings. Editing a list never
//  requires a code change.
// ─────────────────────────────────────────────────────────────
import { el, clear, clone, toast, uid, isoDate } from '../util.js';
import { saveSettings } from '../store.js';
import { mount, loading, openDialog, confirmDialog } from './shell.js';
import { navigate } from '../app.js';

let CTX = null;

export function renderReminders(ctx) {
  if (ctx) CTX = ctx;
  if (!CTX?.settings) return loading('Menyiapkan…');
  draw();
}

function lists() {
  CTX.settings.reminders = CTX.settings.reminders || [];
  return CTX.settings.reminders;
}

function persist() {
  return saveSettings(CTX.settings).catch(err => {
    toast(`Gagal menyimpan: ${err?.code || err?.message || err}`);
  });
}

/** Ticks are stored as { [stepId]: 'YYYY-MM-DD' } and read as
    checked only when that date is today. */
function isDone(list, stepId, today) {
  return (list.ticks || {})[stepId] === today;
}

function draw() {
  const today = isoDate();
  const all = lists();

  const body = el('div');

  if (!all.length) {
    body.append(el('div', { class: 'empty' },
      el('h3', { text: 'Belum ada pengingat' }),
      el('p', { class: 'small', text:
        'Buat daftar langkah untuk tugas yang berulang — persiapan Morning '
        + 'Report, operan jaga, dan sejenisnya.' }),
      el('p', { class: 'small faint', text:
        'Centang otomatis kosong lagi setiap hari baru.' }),
    ));
  }

  for (const list of all) {
    const steps = list.steps || [];
    const doneCount = steps.filter(s => isDone(list, s.id, today)).length;
    const nextIdx = steps.findIndex(s => !isDone(list, s.id, today));
    const complete = steps.length > 0 && doneCount === steps.length;

    const rows = el('div');
    steps.forEach((step, i) => {
      const done = isDone(list, step.id, today);
      const isNext = i === nextIdx;
      const cbId = uid('rm_');

      rows.append(el('label', {
        class: 'rem-step' + (done ? ' done' : '') + (isNext ? ' next' : ''),
        for: cbId,
      },
        el('input', {
          type: 'checkbox', id: cbId, checked: done,
          onChange: async (e) => {
            list.ticks = list.ticks || {};
            if (e.target.checked) list.ticks[step.id] = today;
            else delete list.ticks[step.id];
            await persist();
            draw();
          },
        }),
        el('span', { class: 'rem-num', text: String(i + 1) }),
        el('span', { class: 'rem-text' },
          step.text || '(langkah kosong)',
          step.note ? el('div', { class: 'small faint', text: step.note }) : null,
        ),
      ));
    });

    body.append(el('div', { class: 'panel' },
      el('div', { class: 'panel-head' },
        el('h3', { text: list.name || '(tanpa nama)' }),
        el('span', {
          class: 'chip' + (complete ? ' chip-accent' : ''),
          text: `${doneCount}/${steps.length}`,
        }),
        el('span', { class: 'spacer' }),
        doneCount ? el('button', {
          class: 'btn-sm btn-ghost',
          onClick: async () => { list.ticks = {}; await persist(); draw(); },
        }, 'Kosongkan') : null,
        el('button', { class: 'btn-sm btn-ghost',
          onClick: () => openListEditor(list) }, 'Ubah'),
      ),
      steps.length
        ? rows
        : el('p', { class: 'small faint', text: 'Belum ada langkah.' }),
      complete
        ? el('div', { class: 'notice notice-accent', style: 'margin-top:10px',
            text: '✓ Semua langkah selesai hari ini.' })
        : null,
    ));
  }

  mount(el('div', {},
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),

    el('div', { class: 'toolbar' },
      el('h2', { style: 'flex:1', text: 'Pengingat' }),
      el('button', { class: 'btn-primary',
        onClick: () => openListEditor(null) }, '+ Daftar baru'),
    ),
    el('p', { class: 'small faint', style: 'margin-top:0' },
      'Centang kosong sendiri setiap hari. Langkah berikutnya ditandai.'),

    body,
  ));
}

/* ── Editor ─────────────────────────────────────────────────── */

function openListEditor(existing) {
  const isNew = !existing;
  const draft = existing
    ? clone(existing)
    : { id: uid('rem_'), name: '', steps: [], ticks: {} };

  const { body, foot, close } = openDialog(isNew ? 'Daftar baru' : 'Ubah daftar', { wide: true });

  const nameInput = el('input', {
    value: draft.name || '',
    placeholder: 'mis. Persiapan Morning Report',
    onInput: (e) => { draft.name = e.target.value; },
  });

  const stepsWrap = el('div');

  function drawSteps(focusIdx = null) {
    clear(stepsWrap);
    draft.steps = draft.steps || [];

    draft.steps.forEach((step, i) => {
      stepsWrap.append(el('div', { class: 'bullet-row' },
        el('span', { class: 'chip', style: 'flex:none', text: String(i + 1) }),
        el('input', {
          value: step.text || '', placeholder: 'Langkah…',
          onInput: (e) => { draft.steps[i].text = e.target.value; },
          onKeydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              draft.steps.splice(i + 1, 0, { id: uid('st_'), text: '' });
              drawSteps(i + 1);
            }
          },
        }),
        el('button', { class: 'btn-sm btn-ghost', type: 'button', title: 'Naik',
          disabled: i === 0,
          onClick: () => {
            const a = draft.steps;
            [a[i - 1], a[i]] = [a[i], a[i - 1]];
            drawSteps();
          } }, '↑'),
        el('button', { class: 'btn-sm btn-ghost btn-danger', type: 'button',
          onClick: () => { draft.steps.splice(i, 1); drawSteps(); } }, '✕'),
      ));
    });

    stepsWrap.append(el('div', { class: 'btn-row', style: 'margin-top:8px' },
      el('button', { class: 'btn-sm', type: 'button',
        onClick: () => {
          draft.steps.push({ id: uid('st_'), text: '' });
          drawSteps(draft.steps.length - 1);
        } }, '+ Tambah langkah'),
    ));

    if (focusIdx != null) stepsWrap.querySelectorAll('input')[focusIdx]?.focus();
  }
  drawSteps();

  body.append(
    el('div', { class: 'field' }, el('label', { text: 'Nama daftar' }), nameInput),
    el('div', { class: 'field' },
      el('label', { text: 'Langkah (berurutan)' }),
      stepsWrap,
      el('div', { class: 'small faint', text: 'Tekan Enter untuk langkah berikutnya.' }),
    ),
  );

  foot.append(
    !isNew ? el('button', { class: 'btn-danger', onClick: async () => {
      const ok = await confirmDialog('Hapus daftar', `Hapus "${draft.name}"?`);
      if (!ok) return;
      const arr = lists();
      const i = arr.findIndex(x => x.id === draft.id);
      if (i >= 0) arr.splice(i, 1);
      await persist(); close(); draw();
      toast('Daftar dihapus');
    } }, 'Hapus') : null,
    el('button', { onClick: close }, 'Batal'),
    el('button', { class: 'btn-primary', onClick: async () => {
      draft.name = String(draft.name || '').trim() || 'Tanpa nama';
      draft.steps = (draft.steps || []).filter(s => String(s.text || '').trim());
      const arr = lists();
      const i = arr.findIndex(x => x.id === draft.id);
      if (i >= 0) arr[i] = draft; else arr.push(draft);
      await persist(); close(); draw();
      toast(isNew ? 'Daftar dibuat' : 'Daftar disimpan');
    } }, 'Simpan'),
  );

  nameInput.focus();
}

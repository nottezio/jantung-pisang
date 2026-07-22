// ═══════════════════════════════════════════════════════════
//  SOAP ENTRY EDITOR
//
//  ⭐ The whole architecture lands here. This file contains ONE
//     loop over template.sections[]. It does not know what a
//     vital sign is. Adding a section in Pengaturan produces a
//     working input here with no code change — that is the test
//     of hard requirements #3 and #8.
// ═══════════════════════════════════════════════════════════
import { el, clone, formatDateID, isoDate, toast } from '../util.js';
import { normalizeSections, orphanKeys } from '../schema.js';
import { renderSectionEditor } from '../sections/index.js';
import { createEntry, updateEntry } from '../store.js';
import { mount, showError } from './shell.js';
import { openPreview } from './preview.js';
import { REPORT_TYPES } from '../seed.js';
import { renderPatientDetail } from './patient-detail.js';

export function openSoapEditor({ patient, ctx, draft, existingId = null, onSaved }) {
  const template = ctx.template;
  if (!template) return showError('Belum ada template. Buat satu di Pengaturan.');

  // Reconcile against the CURRENT template. Sections the template
  // no longer declares are retained untouched — never purged.
  const entry = {
    ...clone(draft),
    sections: normalizeSections(draft.sections, template),
  };
  const orphans = orphanKeys(draft.sections, template);
  let dirty = !existingId;

  const markDirty = () => { dirty = true; saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; };

  /* ── Header ── */
  const dateInput = el('input', {
    type: 'date', value: entry.date || isoDate(),
    onInput: (e) => { entry.date = e.target.value; markDirty(); },
  });

  const typeSelect = el('select', {
    onChange: (e) => { entry.reportType = e.target.value; markDirty(); },
  }, ...REPORT_TYPES.map(r =>
    el('option', { value: r.value, selected: entry.reportType === r.value }, r.label)));

  const templateSelect = el('select', {
    onChange: (e) => {
      const next = ctx.templates.find(t => t.id === e.target.value);
      if (!next) return;
      ctx.template = next;
      entry.templateId = next.id;
      entry.templateVersion = next.version || 1;
      entry.sections = normalizeSections(entry.sections, next);
      markDirty();
      drawSections();
    },
  }, ...ctx.templates.map(t =>
    el('option', { value: t.id, selected: t.id === (entry.templateId || template.id) }, t.name)));

  const header = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('div', { style: 'flex:1;min-width:0' },
        el('div', { class: 'eyebrow', text: existingId ? 'Ubah entri' : 'Entri baru' }),
        el('h2', { text: patient.name || '(tanpa nama)' }),
      ),
    ),
    el('div', { class: 'field-row' },
      el('div', { class: 'field' }, el('label', { text: 'Tanggal' }), dateInput),
      el('div', { class: 'field' }, el('label', { text: 'Jenis laporan' }), typeSelect),
    ),
    ctx.templates.length > 1
      ? el('div', { class: 'field' }, el('label', { text: 'Template' }), templateSelect)
      : null,
    draft.carriedFromId && !existingId
      ? el('div', { class: 'notice notice-accent',
          text: 'Disalin dari entri sebelumnya, termasuk pilihan pemeriksaan. '
              + 'Ubah yang berubah saja.' })
      : null,
    orphans.length
      ? el('div', { class: 'notice',
          text: `${orphans.length} bagian lama tersimpan tapi tidak ada di template aktif `
              + `(${orphans.join(', ')}). Datanya tetap aman dan akan muncul kembali `
              + 'jika bagian itu ditambahkan lagi.' })
      : null,
  );

  /* ═══════════════════════════════════════════════════════
     THE LOOP. This is the entire clinical form.
     ═══════════════════════════════════════════════════════ */
  const sectionsWrap = el('div');

  function drawSections() {
    sectionsWrap.replaceChildren();
    for (const section of ctx.template.sections || []) {
      sectionsWrap.append(
        renderSectionEditor(
          section,
          entry.sections[section.key],
          (next) => { entry.sections[section.key] = next; markDirty(); },
          {
            patient,
            entry,
            onIncludedChange: (ids) => { entry.includedInvestigationIds = ids; markDirty(); },
          },
        ),
      );
    }
  }
  drawSections();

  /* ── Actions ── */
  const err = el('div', { class: 'notice notice-warn', hidden: true });

  const saveBtn = el('button', {
    class: 'btn-primary', disabled: !dirty,
    onClick: () => save({ thenPreview: false }),
  }, dirty ? 'Simpan' : 'Tersimpan');

  const previewBtn = el('button', {
    onClick: () => save({ thenPreview: true }),
  }, 'Render & salin →');

  const backBtn = el('button', {
    class: 'btn-ghost',
    onClick: () => renderPatientDetail(patient.id, ctx),
  }, '← Kembali');

  const actions = el('div', { class: 'panel' },
    err,
    el('div', { class: 'btn-row' }, backBtn, el('span', { class: 'spacer' }), saveBtn, previewBtn),
  );

  async function save({ thenPreview }) {
    err.hidden = true;
    saveBtn.disabled = true;
    const prevLabel = saveBtn.textContent;
    saveBtn.textContent = 'Menyimpan…';
    try {
      if (existingId) {
        await updateEntry(existingId, entry);
      } else {
        const id = await createEntry(entry);
        existingId = id;   // subsequent saves update rather than duplicate
      }
      dirty = false;
      saveBtn.textContent = 'Tersimpan';
      saveBtn.disabled = true;
      toast('Entri disimpan');
      onSaved?.();
      if (thenPreview) {
        openPreview({ patient, entry, template: ctx.template, settings: ctx.settings });
      }
    } catch (ex) {
      err.textContent = `Gagal menyimpan: ${ex?.message || ex}`;
      err.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = prevLabel;
    }
  }

  // Guard against losing edits to a stray back-swipe or reload.
  const beforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  // Removed when the view is replaced; harmless if it lingers a
  // moment, since it only fires on a real page unload.
  setTimeout(() => {
    const observer = new MutationObserver(() => {
      if (!document.contains(sectionsWrap)) {
        window.removeEventListener('beforeunload', beforeUnload);
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('view'), { childList: true });
  }, 0);

  mount(el('div', {}, header, sectionsWrap, actions));
}

// ─────────────────────────────────────────────────────────────
//  PATIENT DETAIL
//
//  Hard requirement #3 made visible: ONE patient, MANY dated SOAP
//  entries, newest first, spanning the whole admission.
// ─────────────────────────────────────────────────────────────
import {
  el, computeAge, computeHariPerawatan, locationFull, formatDateID, toast, isoDate,
} from '../util.js';
import {
  getPatient, listEntries, deletePatient, deleteEntry,
  carryForwardEntry, blankEntry,
} from '../store.js';
import { mount, loading, showError, confirmDialog } from './shell.js';
import { openPatientForm } from './patient-form.js';
import { investigationList } from './investigations.js';
import { openSoapEditor } from './soap-editor.js';
import { navigate } from '../app.js';

export async function renderPatientDetail(id, ctx) {
  loading('Memuat pasien…');
  let patient, entries;
  try {
    patient = await getPatient(id);
    if (!patient) return showError('Pasien tidak ditemukan.');
    entries = await listEntries(id);
  } catch (err) {
    return showError('Gagal memuat pasien.', err?.message);
  }
  draw(patient, entries, ctx);
}

const refresh = (patient, ctx) => renderPatientDetail(patient.id, ctx);

function draw(patient, entries, ctx) {
  const age  = computeAge(patient.dob);
  const hari = computeHariPerawatan(patient.admissionDate);

  const header = el('div', { style: 'margin-bottom:14px' },
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),

    el('div', { class: 'panel' },
      el('div', { class: 'panel-head' },
        el('div', { style: 'flex:1;min-width:0' },
          el('h2', { text: patient.name || '(tanpa nama)' }),
          el('div', { class: 'pt-meta', text: [
            patient.gender,
            age !== '' ? `${age} tahun` : null,
            patient.dob ? `lahir ${formatDateID(patient.dob)}` : null,
            patient.mrn ? `RM ${patient.mrn}` : null,
            patient.insurance || null,
          ].filter(Boolean).join(' · ') }),
        ),
        el('button', {
          class: 'btn-sm',
          onClick: () => openPatientForm(patient, () => refresh(patient, ctx)),
        }, 'Ubah'),
      ),

      patient.mainDiagnosis && el('p', { style: 'margin:0 0 10px', text: patient.mainDiagnosis }),

      el('div', { class: 'pt-foot' },
        locationFull(patient.location) && el('span', { class: 'chip', text: locationFull(patient.location) }),
        hari !== '' && el('span', { class: 'chip', text: `Hari perawatan ke-${hari}` }),
        patient.admissionDate && el('span', { class: 'chip', text: `Masuk ${formatDateID(patient.admissionDate)}` }),
        patient.entryType && el('span', { class: 'chip', text: patient.entryType }),
        patient.currentPhase && el('span', { class: 'chip chip-accent', text: patient.currentPhase }),
        patient.konsulSubtype && el('span', { class: 'chip', text: patient.konsulSubtype }),
        patient.disposition && el('span', { class: 'chip chip-out',
          text: `${patient.disposition.type} · ${formatDateID(patient.disposition.date)}` }),
      ),

      (patient.dpjp || []).length ? el('div', { style: 'margin-top:12px' },
        el('div', { class: 'eyebrow', text: 'DPJP' }),
        ...patient.dpjp.filter(d => d.name).map(d =>
          el('div', { class: 'small' },
            el('span', { class: 'faint', text: `${d.role}: ` }), d.name)),
      ) : null,
    ),
  );

  /* ── SOAP entries: the whole admission ── */
  const soapPanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Catatan SOAP' }),
      el('span', { class: 'chip', text: String(entries.length) }),
      el('span', { class: 'spacer' }),
    ),
  );

  const latest = entries[0];
  const todayHasEntry = entries.some(e => e.date === isoDate());

  const actions = el('div', { class: 'btn-row', style: 'margin-bottom:12px' });

  if (latest) {
    // ⭐ THE PRIMARY DAILY ACTION. Listed first, styled primary.
    actions.append(el('button', {
      class: 'btn-primary',
      onClick: () => openSoapEditor({
        patient, ctx,
        draft: carryForwardEntry(latest, ctx.template),
        onSaved: () => refresh(patient, ctx),
      }),
    }, '⭐ Entri baru dari kemarin'));
  }

  actions.append(el('button', {
    onClick: () => openSoapEditor({
      patient, ctx,
      draft: blankEntry(patient.id, ctx.template),
      onSaved: () => refresh(patient, ctx),
    }),
  }, '+ Entri kosong'));

  soapPanel.append(actions);

  if (todayHasEntry) {
    soapPanel.append(el('div', { class: 'notice notice-accent',
      text: `Sudah ada entri bertanggal hari ini (${formatDateID(isoDate())}).` }));
  }

  if (!entries.length) {
    soapPanel.append(el('div', { class: 'empty' },
      el('p', { class: 'small', text: 'Belum ada catatan SOAP.' }),
      el('p', { class: 'small faint',
        text: 'Setelah entri pertama, entri harian berikutnya tinggal disalin dari yang kemarin.' }),
    ));
  } else {
    for (const entry of entries) {
      soapPanel.append(entryRow(entry, patient, ctx));
    }
  }

  /* ── Investigations ── */
  const invPanel = el('div', { class: 'panel' },
    investigationList(patient, () => { /* in-place; no reload needed */ }),
  );

  /* ── Danger zone ── */
  const danger = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' }, el('h3', { text: 'Hapus pasien' })),
    el('p', { class: 'small faint',
      text: 'Menghapus pasien juga menghapus seluruh catatan SOAP-nya. Tidak dapat dibatalkan.' }),
    el('button', {
      class: 'btn-danger',
      onClick: async () => {
        const ok = await confirmDialog('Hapus pasien',
          `Hapus ${patient.name} beserta ${entries.length} catatan SOAP?`);
        if (!ok) return;
        await deletePatient(patient.id);
        toast('Pasien dihapus');
        navigate({ route: 'patients' });
      },
    }, 'Hapus pasien ini'),
  );

  mount(el('div', {}, header, soapPanel, invPanel, danger));
}

function entryRow(entry, patient, ctx) {
  const invCount = (entry.includedInvestigationIds || []).length;
  const staleTemplate = entry.templateVersion != null
    && ctx.template?.version != null
    && entry.templateVersion !== ctx.template.version;

  return el('div', { class: 'list-row' },
    el('div', { style: 'flex:1;min-width:0' },
      el('div', {},
        el('strong', { text: formatDateID(entry.date, true) || '(tanpa tanggal)' }),
        entry.carriedFromId && el('span', { class: 'faint small', text: ' · disalin' }),
      ),
      el('div', { class: 'small faint', text: [
        entry.reportType || null,
        invCount ? `${invCount} pemeriksaan dikutip` : 'tanpa pemeriksaan',
      ].filter(Boolean).join(' · ') }),
      staleTemplate && el('div', { class: 'small', style: 'color:var(--stage-early)',
        text: 'Template sudah berubah sejak entri ini dibuat — hasil render bisa berbeda dari yang dikirim.' }),
    ),
    el('button', {
      class: 'btn-sm',
      onClick: () => openSoapEditor({
        patient, ctx, draft: entry, existingId: entry.id,
        onSaved: () => renderPatientDetail(patient.id, ctx),
      }),
    }, 'Buka'),
    el('button', {
      class: 'btn-sm btn-ghost btn-danger',
      onClick: async () => {
        const ok = await confirmDialog('Hapus entri',
          `Hapus catatan SOAP ${formatDateID(entry.date)}?`);
        if (!ok) return;
        await deleteEntry(entry.id);
        toast('Entri dihapus');
        renderPatientDetail(patient.id, ctx);
      },
    }, 'Hapus'),
  );
}

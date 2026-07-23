// ─────────────────────────────────────────────────────────────
//  PATIENT DETAIL
//
//  Ordering rule: the daily action goes first. Opening a patient
//  during rounds means writing today's SOAP, not re-reading their
//  MRN — so identity is compressed to one line and the entry list
//  sits at the top.
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
import { stageTrack } from './stage.js';
import { openSideBySide } from './sidebyside.js';

export async function renderPatientDetail(id, ctx) {
  loading('Memuat pasien…');
  let patient, entries;
  try {
    patient = await getPatient(id);
    if (!patient) return showError('Pasien tidak ditemukan.');
    entries = await listEntries(id);
  } catch (err) {
    return showError('Gagal memuat pasien.', `${err?.code || ''} ${err?.message || ''}`);
  }
  draw(patient, entries, ctx);
}

const refresh = (patient, ctx) => renderPatientDetail(patient.id, ctx);

function draw(patient, entries, ctx) {
  const age = computeAge(patient.dob);
  const hari = computeHariPerawatan(patient.admissionDate);

  /* ── Identity: one line, not a panel of rows ── */
  const identity = el('div', { style: 'margin-bottom:14px' },
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),

    el('div', { class: 'panel-head', style: 'margin-bottom:2px' },
      el('h2', { style: 'flex:1;min-width:0', text: patient.name || '(tanpa nama)' }),
      el('button', {
        class: 'btn-sm btn-ghost',
        onClick: () => openPatientForm(patient, () => refresh(patient, ctx)),
      }, 'Ubah'),
    ),

    el('div', { class: 'pt-meta', style: 'margin-bottom:6px', text: [
      age !== '' ? `${age} thn` : null,
      patient.mrn ? `RM ${patient.mrn}` : null,
      locationFull(patient.location) || null,
      hari !== '' ? `hari ke-${hari}` : null,
    ].filter(Boolean).join(' · ') }),

    patient.mainDiagnosis
      ? el('div', { style: 'margin-bottom:6px', text: patient.mainDiagnosis })
      : null,

    (patient.dpjp || []).some(d => d.name)
      ? el('div', { class: 'small faint', text:
          patient.dpjp.filter(d => d.name).map(d => d.name).join(' · ') })
      : null,

    patient.disposition
      ? el('div', { class: 'chip chip-out', style: 'margin-top:8px',
          text: `${patient.disposition.type} · ${formatDateID(patient.disposition.date)}` })
      : null,
  );

  // Workflow tracker. Hidden for discharged patients — there is no
  // daily loop left to track.
  if (!patient.disposition) {
    const track = stageTrack(patient, ctx);
    if (track) identity.append(el('div', { style: 'margin-top:10px' }, track));
  }

  /* ── SOAP entries: the reason this screen exists ── */
  const latest = entries[0];
  const todayHasEntry = entries.some(e => e.date === isoDate());

  const actions = el('div', { class: 'btn-row', style: 'margin-bottom:12px' });
  if (latest) {
    actions.append(el('button', {
      class: 'btn-primary',
      onClick: () => openSoapEditor({
        patient, ctx,
        draft: carryForwardEntry(latest, ctx.template),
        onSaved: () => refresh(patient, ctx),
      }),
    }, '⭐ SOAP hari ini (salin kemarin)'));
  }
  if (latest) {
    actions.append(el('button', {
      onClick: () => openSideBySide({
        patient, entry: latest, template: ctx.template, ctx,
      }),
    }, 'Susun dengan format'));
  }
  actions.append(el('button', {
    class: latest ? '' : 'btn-primary',
    onClick: () => openSoapEditor({
      patient, ctx,
      draft: blankEntry(patient.id, ctx.template),
      onSaved: () => refresh(patient, ctx),
    }),
  }, latest ? '+ Kosong' : '+ SOAP pertama'));

  const soapPanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'SOAP harian' }),
      el('span', { class: 'chip', text: String(entries.length) }),
      el('span', { class: 'spacer' }),
    ),
    actions,
    todayHasEntry
      ? el('div', { class: 'notice notice-accent',
          text: `Sudah ada entri hari ini (${formatDateID(isoDate())}).` })
      : null,
  );

  if (!entries.length) {
    soapPanel.append(el('div', { class: 'empty' },
      el('p', { class: 'small', text: 'Belum ada SOAP.' }),
      el('p', { class: 'small faint',
        text: 'Setelah entri pertama, entri harian berikutnya tinggal disalin.' }),
    ));
  } else {
    for (const entry of entries) soapPanel.append(entryRow(entry, patient, ctx));
  }

  /* ── Investigations ── */
  const invPanel = el('div', { class: 'panel' },
    investigationList(patient, () => {}),
  );

  /* ── Delete, folded away ── */
  const danger = el('details', { style: 'margin-top:4px' },
    el('summary', {
      style: 'cursor:pointer;padding:10px 0;font-size:.85rem;color:var(--ink-faint)',
    }, 'Hapus pasien'),
    el('div', { style: 'padding:6px 0 16px' },
      el('p', { class: 'small faint',
        text: 'Menghapus pasien juga menghapus seluruh SOAP-nya. Tidak dapat dibatalkan.' }),
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
    ),
  );

  mount(el('div', {}, identity, soapPanel, invPanel, danger));
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
        entry.carriedFromId ? el('span', { class: 'faint small', text: ' · disalin' }) : null,
      ),
      el('div', { class: 'small faint', text:
        invCount ? `${invCount} pemeriksaan dikutip` : 'tanpa pemeriksaan' }),
      staleTemplate
        ? el('div', { class: 'small', style: 'color:var(--stage-early)',
            text: 'Template berubah sejak entri ini dibuat.' })
        : null,
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
          `Hapus SOAP ${formatDateID(entry.date)}?`);
        if (!ok) return;
        await deleteEntry(entry.id);
        toast('Entri dihapus');
        renderPatientDetail(patient.id, ctx);
      },
    }, 'Hapus'),
  );
}

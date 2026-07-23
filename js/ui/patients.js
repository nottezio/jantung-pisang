// ─────────────────────────────────────────────────────────────
//  PATIENT LIST — the default view
// ─────────────────────────────────────────────────────────────
import { el, computeAge, computeHariPerawatan, compareNatural, locationFull, toast } from '../util.js';
import { listPatients } from '../store.js';
import { mount, loading, showError } from './shell.js';
import { openPatientForm } from './patient-form.js';
import { navigate } from '../app.js';
import { stageTrack } from './stage.js';

const SORTS = {
  room: {
    label: 'Kamar & bed',
    fn: (a, b) =>
      compareNatural(a.location?.floor, b.location?.floor) ||
      compareNatural(a.location?.room,  b.location?.room)  ||
      compareNatural(a.location?.bed,   b.location?.bed)   ||
      compareNatural(a.name, b.name),
  },
  name: {
    label: 'Nama',
    fn: (a, b) => compareNatural(a.name, b.name),
  },
  admission: {
    label: 'Tanggal masuk',
    fn: (a, b) => String(a.admissionDate || '').localeCompare(String(b.admissionDate || ''))
              || compareNatural(a.name, b.name),
  },
};

let sortKey = 'room';
let showDischarged = false;

let CTX = null;

export async function renderPatients(ctx) {
  if (ctx) CTX = ctx;
  loading('Memuat daftar pasien…');
  let patients;
  try {
    patients = await listPatients();
  } catch (err) {
    return showError('Gagal memuat daftar pasien.', err?.message);
  }
  draw(patients);
}

function draw(all) {
  const active = all.filter(p => !p.disposition);
  const gone   = all.filter(p => p.disposition);
  const shown  = (showDischarged ? gone : active).slice().sort(SORTS[sortKey].fn);

  const toolbar = el('div', { class: 'toolbar' },
    el('select', {
      'aria-label': 'Urutkan',
      onChange: (e) => { sortKey = e.target.value; draw(all); },
    }, ...Object.entries(SORTS).map(([k, s]) =>
      el('option', { value: k, selected: k === sortKey }, `Urut: ${s.label}`))),

    el('button', {
      class: 'btn-sm' + (showDischarged ? ' btn-primary' : ''),
      onClick: () => { showDischarged = !showDischarged; draw(all); },
    }, showDischarged ? `Aktif (${active.length})` : `Sudah keluar (${gone.length})`),

    el('span', { class: 'spacer' }),

    el('button', {
      class: 'btn-primary',
      onClick: () => openPatientForm(null, () => renderPatients()),
    }, '+ Pasien baru'),
  );

  const head = el('div', { style: 'margin-bottom:10px' },
    el('div', { class: 'eyebrow', text: showDischarged ? 'Sudah keluar' : 'Pasien aktif' }),
    el('h2', { text: `${shown.length} pasien` }),
  );

  const body = shown.length
    ? el('div', { class: 'card-grid' }, ...shown.map(patientCard))
    : emptyState();

  mount(el('div', {}, toolbar, head, body));
}

function emptyState() {
  if (showDischarged) {
    return el('div', { class: 'empty' },
      el('h3', { text: 'Belum ada pasien yang keluar' }),
      el('p', { class: 'small', text: 'Pasien pindah ke sini setelah diberi status kepulangan.' }),
    );
  }
  return el('div', { class: 'empty' },
    el('h3', { text: 'Belum ada pasien' }),
    el('p', { class: 'small', text: 'Tambahkan pasien pertama untuk memulai.' }),
    el('button', {
      class: 'btn-primary', style: 'margin-top:12px',
      onClick: () => openPatientForm(null, () => renderPatients()),
    }, '+ Pasien baru'),
  );
}

function patientCard(p) {
  const age  = computeAge(p.dob);
  const hari = computeHariPerawatan(p.admissionDate);
  const utama = (p.dpjp || []).find(d => /utama/i.test(d.role || '')) || (p.dpjp || [])[0];

  // The card is a div, not a button: the stage dots are themselves
  // buttons, and nesting interactive elements is invalid and breaks
  // keyboard navigation.
  const body = el('button', {
    class: 'card-body-btn',
    onClick: () => navigate({ route: 'patient', id: p.id }),
  },
    el('div', { class: 'pt-name', text: p.name || '(tanpa nama)' }),
    el('div', { class: 'pt-meta', text: [
      p.gender,
      age !== '' ? `${age} thn` : null,
      p.mrn ? `RM ${p.mrn}` : null,
    ].filter(Boolean).join(' · ') }),

    el('div', { class: 'pt-dx', text: p.mainDiagnosis || '—' }),

    el('div', { class: 'pt-foot' },
      locationFull(p.location) && el('span', { class: 'chip', text: locationFull(p.location) }),
      hari !== '' && el('span', { class: 'chip', text: `Hari ke-${hari}` }),
      p.currentPhase && el('span', { class: 'chip chip-accent', text: p.currentPhase }),
      utama?.name && el('span', { class: 'chip', text: utama.name }),
      p.disposition && el('span', { class: 'chip chip-out', text: p.disposition.type }),
      p.followUpExempt && el('span', { class: 'chip', text: 'tanpa FU harian' }),
    ),
  );

  const card = el('div', { class: 'card' }, body);

  const track = CTX && !p.disposition
    ? stageTrack(p, CTX, { compact: true })
    : null;
  if (track) card.append(track);

  return card;
}

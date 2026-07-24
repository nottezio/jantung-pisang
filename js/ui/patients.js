// ─────────────────────────────────────────────────────────────
//  PATIENT LIST — the default view
// ─────────────────────────────────────────────────────────────
import { el, computeAge, computeHariPerawatan, compareNatural, locationFull, formatDateID, toast } from '../util.js';
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

const GROUPS = {
  none:   { label: 'Tanpa grup', of: () => '' },
  holder: { label: 'Pemegang',   of: (p) => p.assignedTo || 'Belum ditentukan' },
  floor:  { label: 'Lantai',     of: (p) => p.location?.floor ? `Lantai ${p.location.floor}` : 'Tanpa lantai' },
  room:   { label: 'Kamar',      of: (p) => p.location?.room ? `Kamar ${p.location.room}` : 'Tanpa kamar' },
  dpjp:   { label: 'DPJP',       of: (p) => (p.dpjp || []).find(d => d.name)?.name || 'Tanpa DPJP' },
};

// Held so patient cards can reach settings.stages without threading
// ctx through every call site.
let CTX = null;

let sortKey = 'room';
let groupKey = 'none';
let showDischarged = false;
let searchTerm = '';

export async function renderPatients(ctx) {
  if (ctx) CTX = ctx;
  loading('Memuat daftar pasien…');
  let patients;
  try {
    patients = await listPatients();
  } catch (err) {
    return showError('Gagal memuat daftar pasien.', `${err?.code || ''} ${err?.message || ''}`);
  }
  draw(patients);
}

function matches(p, q) {
  if (!q) return true;
  const hay = [p.name, p.mrn, p.mainDiagnosis, p.assignedTo,
               locationFull(p.location), ...(p.dpjp || []).map(d => d.name)]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function draw(all) {
  const active = all.filter(p => !p.disposition);
  const gone   = all.filter(p => p.disposition);
  const q = searchTerm.trim().toLowerCase();
  const pool = (showDischarged ? gone : active).filter(p => matches(p, q));

  const toolbar = el('div', { class: 'toolbar' },
    el('select', {
      'aria-label': 'Urutkan',
      onChange: (e) => { sortKey = e.target.value; draw(all); },
    }, ...Object.entries(SORTS).map(([k, sd]) =>
      el('option', { value: k, selected: k === sortKey }, `Urut: ${sd.label}`))),

    el('select', {
      'aria-label': 'Kelompokkan',
      onChange: (e) => { groupKey = e.target.value; draw(all); },
    }, ...Object.entries(GROUPS).map(([k, g]) =>
      el('option', { value: k, selected: k === groupKey }, `Grup: ${g.label}`))),

    el('button', {
      class: 'btn-sm' + (showDischarged ? ' btn-primary' : ''),
      onClick: () => { showDischarged = !showDischarged; draw(all); },
    }, showDischarged ? `Aktif (${active.length})` : `Arsip (${gone.length})`),

    el('span', { class: 'spacer' }),

    !showDischarged ? el('button', {
      class: 'btn-primary',
      onClick: () => openPatientForm(null, () => renderPatients()),
    }, '+ Pasien baru') : null,
  );

  const search = el('input', {
    type: 'search', value: searchTerm,
    placeholder: 'Cari nama, RM, diagnosis, kamar, DPJP…',
    style: 'margin-bottom:12px',
    onInput: (e) => {
      searchTerm = e.target.value;
      const box = document.getElementById('ptResults');
      if (box) box.replaceChildren(...resultNodes(all));
    },
  });

  const head = el('div', { style: 'margin-bottom:10px' },
    el('div', { class: 'eyebrow', text: showDischarged ? 'Arsip' : 'Pasien aktif' }),
    el('h2', { text: `${pool.length} pasien` }),
  );

  mount(el('div', {}, toolbar, search, head,
    el('div', { id: 'ptResults' }, ...resultNodes(all))));
}

function resultNodes(all) {
  const active = all.filter(p => !p.disposition);
  const gone   = all.filter(p => p.disposition);
  const q = searchTerm.trim().toLowerCase();
  const shown = (showDischarged ? gone : active).filter(p => matches(p, q));

  if (!shown.length) return [emptyState()];

  // Archive is grouped by discharge date regardless of the grouping
  // choice: "when did they leave" is the only question asked of it.
  const grouper = showDischarged
    ? (p) => formatDateID(p.disposition?.date) || 'Tanpa tanggal'
    : GROUPS[groupKey].of;

  if (!showDischarged && groupKey === 'none') {
    return [el('div', { class: 'card-grid' },
      ...shown.slice().sort(SORTS[sortKey].fn).map(patientCard))];
  }

  const buckets = new Map();
  for (const p of shown) {
    const k = grouper(p) || '—';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }

  const keys = [...buckets.keys()].sort(showDischarged
    ? (a, b) => b.localeCompare(a)          // newest discharges first
    : compareNatural);

  return keys.map(k => el('div', { style: 'margin-bottom:18px' },
    el('div', { class: 'group-head' },
      el('span', { text: k }),
      el('span', { class: 'chip', text: String(buckets.get(k).length) }),
    ),
    el('div', { class: 'card-grid' },
      ...buckets.get(k).slice().sort(SORTS[sortKey].fn).map(patientCard)),
  ));
}

function emptyState() {
  if (showDischarged) {
    return el('div', { class: 'empty' },
      el('h3', { text: searchTerm ? 'Tidak ada yang cocok' : 'Arsip masih kosong' }),
      el('p', { class: 'small',
        text: 'Pasien pindah ke sini setelah diberi status kepulangan.' }),
    );
  }
  if (searchTerm) {
    return el('div', { class: 'empty' },
      el('h3', { text: 'Tidak ada yang cocok' }),
      el('p', { class: 'small', text: `Tidak ada pasien aktif untuk "${searchTerm}".` }),
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

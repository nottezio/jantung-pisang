// ─────────────────────────────────────────────────────────────
//  PATIENT FORM — add / edit. All fields editable after creation.
// ─────────────────────────────────────────────────────────────
import { el, clear, clone, computeAge, toast } from '../util.js';
import { BLANK_PATIENT, createPatient, updatePatient } from '../store.js';
import { openDialog } from './shell.js';
import {
  DPJP_ROLES, ENTRY_TYPES, PHASES, DISPOSITIONS,
} from '../seed.js';

export function openPatientForm(existing, onSaved) {
  const isNew = !existing;
  const p = existing ? clone(existing) : BLANK_PATIENT();
  const { body, foot, close } = openDialog(isNew ? 'Pasien baru' : 'Ubah data pasien', { wide: true });

  const set = (path, value) => {
    const keys = path.split('.');
    let target = p;
    while (keys.length > 1) target = target[keys.shift()];
    target[keys[0]] = value;
  };

  const text = (label, path, opts = {}) => {
    const cur = path.split('.').reduce((o, k) => o?.[k], p);
    return el('div', { class: 'field' },
      el('label', { text: label }),
      el('input', {
        value: cur ?? '',
        type: opts.type || 'text',
        inputmode: opts.inputMode || null,
        placeholder: opts.placeholder || '',
        onInput: (e) => { set(path, e.target.value); opts.onInput?.(e.target.value); },
      }),
      opts.hint && el('div', { class: 'small faint', text: opts.hint }),
    );
  };

  const select = (label, path, options, opts = {}) => {
    const cur = path.split('.').reduce((o, k) => o?.[k], p);
    return el('div', { class: 'field' },
      el('label', { text: label }),
      el('select', { onChange: (e) => { set(path, e.target.value); opts.onChange?.(e.target.value); } },
        opts.allowBlank && el('option', { value: '' }, '—'),
        ...options.map(o => {
          const value = typeof o === 'string' ? o : o.value;
          const text  = typeof o === 'string' ? o : o.label;
          return el('option', { value, selected: cur === value }, text);
        }),
      ),
    );
  };

  /* ── Identity ── */
  const ageOut = el('div', { class: 'small faint' });
  const refreshAge = () => {
    const a = computeAge(p.dob);
    // Age is COMPUTED, never stored. Hard requirement #5.
    ageOut.textContent = a === '' ? 'Usia dihitung otomatis dari tanggal lahir.' : `Usia saat ini: ${a} tahun`;
  };

  body.append(
    el('h3', { text: 'Identitas' }),
    text('Nama', 'name'),
    el('div', { class: 'field-row' },
      el('div', {},
        text('Tanggal lahir', 'dob', { type: 'date', onInput: refreshAge }),
        ageOut,
      ),
      select('Jenis kelamin', 'gender', ['Laki-laki', 'Perempuan'], { allowBlank: true }),
    ),
    el('div', { class: 'field-row' },
      text('No. RM', 'mrn', { inputMode: 'numeric' }),
      text('Penjamin', 'insurance', { placeholder: 'BPJS / umum / …' }),
    ),
    text('Diagnosis utama', 'mainDiagnosis'),
  );
  refreshAge();

  /* ── Location: structured, not a string. Hard requirement #6. ── */
  body.append(
    el('h3', { text: 'Lokasi' }),
    el('div', { class: 'field-row' },
      text('Bangsal', 'location.ward', { placeholder: 'PJT' }),
      text('Lantai', 'location.floor', { inputMode: 'numeric', placeholder: '4' }),
    ),
    el('div', { class: 'field-row' },
      text('Kamar', 'location.room'),
      text('Bed', 'location.bed'),
    ),
  );

  /* ── DPJP: an ARRAY. Hard requirement #7. ── */
  const dpjpWrap = el('div');
  function drawDpjp() {
    clear(dpjpWrap);
    (p.dpjp || []).forEach((d, i) => {
      dpjpWrap.append(el('div', { class: 'bullet-row' },
        el('select', {
          style: 'flex:0 0 190px',
          onChange: (e) => { p.dpjp[i].role = e.target.value; },
        }, ...DPJP_ROLES.concat(
             DPJP_ROLES.includes(d.role) || !d.role ? [] : [d.role]
           ).map(r => el('option', { value: r, selected: d.role === r }, r))),
        el('input', {
          value: d.name || '', placeholder: 'Nama DPJP',
          onInput: (e) => { p.dpjp[i].name = e.target.value; },
        }),
        el('button', {
          class: 'btn-sm btn-ghost btn-danger', type: 'button',
          onClick: () => { p.dpjp.splice(i, 1); drawDpjp(); },
        }, '✕'),
      ));
    });
    dpjpWrap.append(el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn-sm', type: 'button',
        onClick: () => {
          p.dpjp = p.dpjp || [];
          const used = new Set(p.dpjp.map(d => d.role));
          p.dpjp.push({ role: DPJP_ROLES.find(r => !used.has(r)) || DPJP_ROLES[0], name: '' });
          drawDpjp();
        },
      }, '+ Tambah DPJP'),
    ));
  }
  drawDpjp();
  body.append(el('h3', { text: 'DPJP' }), dpjpWrap);

  /* ── Admission & classification ── */
  const konsulWrap = el('div');
  function drawKonsul() {
    clear(konsulWrap);
    if (p.entryType !== 'Konsul') { p.konsulSubtype = null; return; }
    konsulWrap.append(
      select('Jenis konsul', 'konsulSubtype', [
        { value: 'KJS', label: 'KJS — ko-manajemen berjalan' },
        { value: 'Kelayakan', label: 'Kelayakan — jawaban sekali' },
      ], { allowBlank: true }),
      el('div', { class: 'field-row' },
        text('Departemen perujuk', 'source.dept'),
        text('Dokter perujuk', 'source.referringDoctor'),
      ),
    );
  }

  body.append(
    el('h3', { text: 'Perawatan' }),
    el('div', { class: 'field-row' },
      text('Tanggal masuk', 'admissionDate', { type: 'date',
        hint: 'Hari perawatan dihitung otomatis.' }),
      select('Shift masuk', 'admissionShift', [
        { value: 'dinas', label: 'Dinas' }, { value: 'jaga', label: 'Jaga' },
      ]),
    ),
    el('div', { class: 'field-row' },
      select('Jenis masuk', 'entryType', ENTRY_TYPES, { onChange: drawKonsul }),
      select('Fase saat ini', 'currentPhase', PHASES),
    ),
    konsulWrap,
    text('Dipegang oleh', 'assignedTo', { hint: 'Tampilan saja.' }),
    el('label', { class: 'check' },
      el('input', {
        type: 'checkbox', checked: !!p.followUpExempt,
        onChange: (e) => { p.followUpExempt = e.target.checked; },
      }),
      el('span', { text: 'Dilaporkan, tidak difollow-up harian' }),
    ),
  );
  drawKonsul();

  /* ── Disposition — Phase 1 writes it; the list filters on it ── */
  if (!isNew) {
    const dispWrap = el('div');
    function drawDisp() {
      clear(dispWrap);
      if (!p.disposition) {
        dispWrap.append(el('div', { class: 'btn-row' },
          ...DISPOSITIONS.map(t => el('button', {
            class: 'btn-sm', type: 'button',
            onClick: () => {
              p.disposition = { type: t, date: new Date().toISOString().slice(0, 10) };
              drawDisp();
            },
          }, t)),
        ));
        dispWrap.append(el('div', { class: 'small faint', style: 'margin-top:6px',
          text: 'Menandai kepulangan akan memindahkan pasien keluar dari daftar aktif.' }));
      } else {
        dispWrap.append(el('div', { class: 'notice notice-accent' },
          `${p.disposition.type} · ${p.disposition.date}`),
          el('button', {
            class: 'btn-sm', type: 'button',
            onClick: () => { p.disposition = null; drawDisp(); },
          }, 'Batalkan — kembalikan ke daftar aktif'),
        );
      }
    }
    drawDisp();
    body.append(el('h3', { text: 'Status kepulangan' }), dispWrap);
  }

  /* ── Save ── */
  const err = el('div', { class: 'notice notice-warn', hidden: true, style: 'margin:0 16px' });
  foot.before(err);

  const saveBtn = el('button', { class: 'btn-primary', onClick: save }, isNew ? 'Simpan pasien' : 'Simpan perubahan');
  foot.append(el('button', { onClick: close }, 'Batal'), saveBtn);

  async function save() {
    if (!String(p.name || '').trim()) {
      err.textContent = 'Nama pasien wajib diisi.'; err.hidden = false; return;
    }
    err.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    try {
      // Offline: this resolves from the local cache immediately and
      // syncs later. Never block the user on the network.
      if (isNew) await createPatient(p);
      else       await updatePatient(existing.id, p);
      close();
      toast(isNew ? 'Pasien ditambahkan' : 'Perubahan disimpan');
      onSaved?.();
    } catch (ex) {
      err.textContent = `Gagal menyimpan: ${ex?.message || ex}`;
      err.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Simpan pasien' : 'Simpan perubahan';
    }
  }
}

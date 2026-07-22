// ─────────────────────────────────────────────────────────────
//  PATIENT FORM — add / edit
//
//  Design rule: only fields the daily report actually consumes are
//  visible. Everything else is real, stored, and editable — but
//  folded away, because filling eighteen boxes to add a patient is
//  how a tool stops getting used.
//
//  Visible:  name · dob · mrn · room · bed · diagnosis · DPJP
//  Folded:   gender, insurance, admission, classification, konsul,
//            assignedTo, followUpExempt, disposition
// ─────────────────────────────────────────────────────────────
import { el, clear, clone, computeAge, toast } from '../util.js';
import { BLANK_PATIENT, createPatient, updatePatient, listPatients } from '../store.js';
import { openDialog } from './shell.js';
import { DPJP_ROLES, ENTRY_TYPES, PHASES, DISPOSITIONS } from '../seed.js';

/* Ward and floor repeat for every patient on a rotation. Carrying
   them forward from the most recent patient removes two fields from
   every single add without losing the structured location that the
   Phase 4 floor map needs. */
async function inferWardFloor() {
  try {
    const all = await listPatients();
    const recent = all
      .filter(p => p.location?.ward || p.location?.floor)
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0];
    return { ward: recent?.location?.ward || '', floor: recent?.location?.floor || '' };
  } catch {
    return { ward: '', floor: '' };
  }
}

export async function openPatientForm(existing, onSaved) {
  const isNew = !existing;
  const p = existing ? clone(existing) : BLANK_PATIENT();

  if (isNew) {
    const inferred = await inferWardFloor();
    p.location.ward = inferred.ward;
    p.location.floor = inferred.floor;
  }

  const { body, foot, close } = openDialog(isNew ? 'Pasien baru' : 'Ubah data pasien');

  const set = (path, value) => {
    const keys = path.split('.');
    let target = p;
    while (keys.length > 1) target = target[keys.shift()];
    target[keys[0]] = value;
  };
  const get = (path) => path.split('.').reduce((o, k) => o?.[k], p);

  const text = (label, path, opts = {}) => el('div', { class: 'field' },
    el('label', { text: label }),
    el('input', {
      value: get(path) ?? '',
      type: opts.type || 'text',
      inputmode: opts.inputMode || null,
      placeholder: opts.placeholder || '',
      onInput: (e) => { set(path, e.target.value); opts.onInput?.(e.target.value); },
    }),
    opts.hint && el('div', { class: 'small faint', text: opts.hint }),
  );

  const select = (label, path, options, opts = {}) => el('div', { class: 'field' },
    el('label', { text: label }),
    el('select', { onChange: (e) => { set(path, e.target.value); opts.onChange?.(e.target.value); } },
      opts.allowBlank && el('option', { value: '' }, '—'),
      ...options.map(o => {
        const value = typeof o === 'string' ? o : o.value;
        const txt = typeof o === 'string' ? o : o.label;
        return el('option', { value, selected: get(path) === value }, txt);
      }),
    ),
  );

  /* ═══ ESSENTIALS ═══ */

  const ageOut = el('span', { class: 'small faint' });
  const refreshAge = () => {
    const a = computeAge(p.dob);
    ageOut.textContent = a === '' ? '' : ` · ${a} tahun`;
  };

  body.append(
    text('Nama', 'name'),
    el('div', { class: 'field-row' },
      el('div', {},
        el('label', {}, 'Tanggal lahir', ageOut),
        el('input', { type: 'date', value: p.dob || '',
          onInput: (e) => { p.dob = e.target.value; refreshAge(); } }),
      ),
      text('No. RM', 'mrn', { inputMode: 'numeric' }),
    ),
    el('div', { class: 'field-row' },
      text('Kamar', 'location.room'),
      text('Bed', 'location.bed'),
    ),
  );
  refreshAge();

  /* Ward + floor: a compact line, not two more boxes. */
  const wardLine = el('div', { class: 'field' });
  function drawWardLine(editing) {
    clear(wardLine);
    if (editing) {
      wardLine.append(el('div', { class: 'field-row' },
        text('Bangsal', 'location.ward', { placeholder: 'PJT' }),
        text('Lantai', 'location.floor', { inputMode: 'numeric' }),
      ));
    } else {
      const label = [p.location.ward, p.location.floor && `Lt ${p.location.floor}`]
        .filter(Boolean).join(' ') || 'Bangsal belum diisi';
      wardLine.append(el('div', { class: 'small faint' },
        label, ' · ',
        el('button', {
          class: 'btn-sm btn-ghost', type: 'button',
          style: 'min-height:0;padding:0 4px;text-decoration:underline',
          onClick: () => drawWardLine(true),
        }, 'ubah'),
      ));
    }
  }
  drawWardLine(isNew && !p.location.ward);
  body.append(wardLine);

  body.append(text('Diagnosis', 'mainDiagnosis'));

  /* DPJP — one row by default, add more only if needed. */
  const dpjpWrap = el('div');
  function drawDpjp() {
    clear(dpjpWrap);
    if (!p.dpjp?.length) p.dpjp = [{ role: DPJP_ROLES[0], name: '' }];

    p.dpjp.forEach((d, i) => {
      const roleSelect = el('select', {
        style: 'flex:0 0 150px',
        onChange: (e) => { p.dpjp[i].role = e.target.value; },
      }, ...DPJP_ROLES.map(r => el('option', { value: r, selected: d.role === r }, r)));

      dpjpWrap.append(el('div', { class: 'bullet-row' },
        // Single DPJP is the common case — hide the role picker until
        // there is a second one to disambiguate.
        p.dpjp.length > 1 ? roleSelect : null,
        el('input', { value: d.name || '', placeholder: 'Nama DPJP',
          onInput: (e) => { p.dpjp[i].name = e.target.value; } }),
        p.dpjp.length > 1
          ? el('button', { class: 'btn-sm btn-ghost btn-danger', type: 'button',
              onClick: () => { p.dpjp.splice(i, 1); drawDpjp(); } }, '✕')
          : null,
      ));
    });

    dpjpWrap.append(el('button', {
      class: 'btn-sm btn-ghost', type: 'button',
      style: 'min-height:0;padding:2px 4px',
      onClick: () => {
        const used = new Set(p.dpjp.map(d => d.role));
        p.dpjp.push({ role: DPJP_ROLES.find(r => !used.has(r)) || DPJP_ROLES[0], name: '' });
        drawDpjp();
      },
    }, '+ DPJP lain'));
  }
  drawDpjp();
  body.append(el('div', { class: 'field' }, el('label', { text: 'DPJP' }), dpjpWrap));

  /* ═══ FOLDED: everything the daily report does not read ═══ */

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
  drawKonsul();

  const summaryStyle =
    'cursor:pointer;padding:10px 0;font-size:.85rem;font-weight:600;color:var(--ink-soft)';

  body.append(el('details', { style: 'margin-top:6px' },
    el('summary', { style: summaryStyle }, 'Detail lain (opsional)'),
    el('div', { style: 'padding-top:6px' },
      el('div', { class: 'field-row' },
        select('Jenis kelamin', 'gender', ['Laki-laki', 'Perempuan'], { allowBlank: true }),
        text('Penjamin', 'insurance', { placeholder: 'BPJS / umum' }),
      ),
      el('div', { class: 'field-row' },
        text('Tanggal masuk', 'admissionDate', { type: 'date' }),
        select('Shift masuk', 'admissionShift', [
          { value: 'dinas', label: 'Dinas' }, { value: 'jaga', label: 'Jaga' },
        ]),
      ),
      el('div', { class: 'field-row' },
        select('Jenis masuk', 'entryType', ENTRY_TYPES, { onChange: drawKonsul }),
        select('Fase saat ini', 'currentPhase', PHASES),
      ),
      konsulWrap,
      text('Dipegang oleh', 'assignedTo'),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: !!p.followUpExempt,
          onChange: (e) => { p.followUpExempt = e.target.checked; } }),
        el('span', { text: 'Dilaporkan, tidak difollow-up harian' }),
      ),
    ),
  ));

  /* ═══ Disposition — edit only ═══ */
  if (!isNew) {
    const dispWrap = el('div');
    function drawDisp() {
      clear(dispWrap);
      if (!p.disposition) {
        dispWrap.append(
          el('div', { class: 'btn-row' },
            ...DISPOSITIONS.map(t => el('button', {
              class: 'btn-sm', type: 'button',
              onClick: () => {
                p.disposition = { type: t, date: new Date().toISOString().slice(0, 10) };
                drawDisp();
              },
            }, t)),
          ),
          el('div', { class: 'small faint', style: 'margin-top:6px',
            text: 'Pasien akan keluar dari daftar aktif.' }),
        );
      } else {
        dispWrap.append(
          el('div', { class: 'notice notice-accent',
            text: `${p.disposition.type} · ${p.disposition.date}` }),
          el('button', { class: 'btn-sm', type: 'button',
            onClick: () => { p.disposition = null; drawDisp(); } },
            'Batalkan — kembalikan ke daftar aktif'),
        );
      }
    }
    drawDisp();
    body.append(el('details', { style: 'margin-top:6px' },
      el('summary', { style: summaryStyle }, 'Status kepulangan'),
      el('div', { style: 'padding-top:6px' }, dispWrap),
    ));
  }

  /* ═══ Save ═══ */
  const err = el('div', { class: 'notice notice-warn', hidden: true, style: 'margin:0 16px' });
  foot.before(err);

  const saveBtn = el('button', { class: 'btn-primary', onClick: save },
    isNew ? 'Simpan' : 'Simpan perubahan');
  foot.append(el('button', { onClick: close }, 'Batal'), saveBtn);

  async function save() {
    if (!String(p.name || '').trim()) {
      err.textContent = 'Nama pasien wajib diisi.'; err.hidden = false; return;
    }
    // An empty DPJP row is the default state, not data.
    p.dpjp = (p.dpjp || []).filter(d => String(d.name || '').trim());
    err.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    try {
      if (isNew) await createPatient(p);
      else       await updatePatient(existing.id, p);
      close();
      toast(isNew ? 'Pasien ditambahkan' : 'Perubahan disimpan');
      onSaved?.();
    } catch (ex) {
      err.textContent = `Gagal menyimpan: ${ex?.message || ex}`;
      err.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Simpan' : 'Simpan perubahan';
    }
  }
}

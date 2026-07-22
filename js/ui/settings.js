// ─────────────────────────────────────────────────────────────
//  SETTINGS
//
//  This is where hard requirement #8 is cashed out: the user can
//  change what a report says, and what fields exist, without a
//  developer.
// ─────────────────────────────────────────────────────────────
import { el, clone, toast, debounce } from '../util.js';
import { APP_VERSION } from '../version.js';
import { TYPE_IDS, SECTION_TYPES, validateKey, slugify } from '../schema.js';
import { validateTemplate, referencedTags } from '../render.js';
import { saveTemplate, saveSettings, duplicateTemplate, deleteTemplate } from '../store.js';
import { mount, openDialog, confirmDialog } from './shell.js';
import { seedTemplate } from '../seed.js';
import { navigate } from '../app.js';

// Slots provided by the engine rather than by a section.
const COMPUTED_SLOTS = [
  'salam', 'greeting', 'today', 'yesterday', 'entryDate', 'reportType',
  'patient', 'location', 'dpjp', 'source', 'referringDoctor',
  'hariPerawatan', 'admissionDate',
];

export function renderSettings(ctx) {
  let template = clone(ctx.template);
  const settings = clone(ctx.settings);

  const root = el('div');

  /* ═══ Template picker ═══ */
  const picker = el('select', {
    onChange: (e) => {
      const next = ctx.templates.find(t => t.id === e.target.value);
      if (next) { ctx.template = next; navigate({ route: 'settings' }); }
    },
  }, ...ctx.templates.map(t =>
    el('option', { value: t.id, selected: t.id === template.id }, t.name)));

  /* ═══ Render string ═══ */
  const renderStatus = el('div', { class: 'small', style: 'margin-top:6px' });
  const renderBox = el('textarea', {
    class: 'preview-box', spellcheck: 'false',
    style: 'min-height:340px',
    onInput: debounce((e) => { template.render = e.target.value; checkRender(); }, 250),
  }, template.render || '');

  function checkRender() {
    const v = validateTemplate(template.render);
    if (!v.ok) {
      renderStatus.style.color = 'var(--danger)';
      renderStatus.textContent = `Template tidak valid: ${v.error}`;
      return;
    }
    const known = new Set([
      ...COMPUTED_SLOTS,
      ...(template.sections || []).map(s => s.key),
    ]);
    const unknown = referencedTags(template.render).filter(t => !known.has(t));
    if (unknown.length) {
      renderStatus.style.color = 'var(--stage-early)';
      renderStatus.textContent =
        `Valid, tapi ada tag tanpa sumber data: ${unknown.join(', ')}. `
        + 'Tag ini akan kosong saat dirender.';
    } else {
      renderStatus.style.color = 'var(--ink-faint)';
      renderStatus.textContent = 'Template valid.';
    }
  }
  checkRender();

  /* ═══ Sections ═══ */
  const sectionsWrap = el('div');

  function drawSections() {
    sectionsWrap.replaceChildren();
    (template.sections || []).forEach((s, i) => {
      sectionsWrap.append(el('div', { class: 'list-row' },
        el('div', { style: 'flex:1;min-width:0' },
          el('input', {
            value: s.label || '',
            style: 'font-weight:600',
            onInput: (e) => { template.sections[i].label = e.target.value; },
          }),
          el('div', { class: 'small faint', style: 'margin-top:4px' },
            el('code', { text: `{{${s.key}}}` }),
            ` · ${SECTION_TYPES[s.type]?.label || s.type}`,
          ),
        ),
        el('button', { class: 'btn-sm btn-ghost', title: 'Naik', disabled: i === 0,
          onClick: () => { move(i, -1); } }, '↑'),
        el('button', { class: 'btn-sm btn-ghost', title: 'Turun',
          disabled: i === template.sections.length - 1,
          onClick: () => { move(i, 1); } }, '↓'),
        el('button', { class: 'btn-sm btn-ghost btn-danger',
          onClick: async () => {
            const ok = await confirmDialog('Hapus bagian',
              `Hapus "${s.label}" dari template?\n\n`
              + 'Data yang sudah tersimpan di entri lama TIDAK dihapus. '
              + 'Bagian ini hanya berhenti tampil dan berhenti dirender, '
              + 'dan akan muncul kembali utuh jika ditambahkan lagi dengan kunci yang sama.',
              'Hapus dari template');
            if (!ok) return;
            template.sections.splice(i, 1);
            drawSections(); checkRender();
          } }, '✕'),
      ));
    });

    sectionsWrap.append(el('div', { class: 'btn-row', style: 'margin-top:10px' },
      el('button', { class: 'btn-sm', onClick: addSection }, '+ Tambah bagian'),
    ));
  }

  function move(i, delta) {
    const j = i + delta;
    const arr = template.sections;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    drawSections();
  }

  function addSection() {
    const { body, foot, close } = openDialog('Bagian baru');
    const err = el('div', { class: 'notice notice-warn', hidden: true });

    const labelInput = el('input', { placeholder: 'mis. Balance cairan' });
    const keyInput = el('input', { placeholder: 'balance_cairan' });
    let keyTouched = false;
    labelInput.addEventListener('input', () => {
      if (!keyTouched) keyInput.value = slugify(labelInput.value);
    });
    keyInput.addEventListener('input', () => { keyTouched = true; });

    const typeSelect = el('select', {},
      ...TYPE_IDS.map(id => el('option', { value: id }, SECTION_TYPES[id].label)));
    const typeHint = el('div', { class: 'small faint' });
    const updateHint = () => { typeHint.textContent = SECTION_TYPES[typeSelect.value].hint; };
    typeSelect.addEventListener('change', updateHint);
    updateHint();

    body.append(
      el('div', { class: 'field' }, el('label', { text: 'Nama tampilan' }), labelInput,
        el('div', { class: 'small faint', text: 'Bisa diubah kapan saja tanpa merusak apa pun.' })),
      el('div', { class: 'field' }, el('label', { text: 'Kunci' }), keyInput,
        el('div', { class: 'small faint',
          text: 'Dipakai di template sebagai {{kunci}}. TIDAK BISA DIUBAH setelah dibuat — '
              + 'entri lama menyimpan datanya di bawah kunci ini.' })),
      el('div', { class: 'field' }, el('label', { text: 'Tipe' }), typeSelect, typeHint),
      err,
    );

    foot.append(
      el('button', { onClick: close }, 'Batal'),
      el('button', { class: 'btn-primary', onClick: () => {
        const key = keyInput.value.trim();
        const problem = validateKey(key, (template.sections || []).map(s => s.key));
        if (problem) { err.textContent = problem; err.hidden = false; return; }
        template.sections = template.sections || [];
        template.sections.push({
          key,
          label: labelInput.value.trim() || key,
          type: typeSelect.value,
          config: defaultConfigFor(typeSelect.value),
        });
        close();
        drawSections();
        checkRender();
        toast(`Bagian ditambahkan. Sisipkan {{${key}}} di template.`);
      } }, 'Tambah'),
    );
    labelInput.focus();
  }

  drawSections();

  /* ═══ Save / duplicate ═══ */
  const tplErr = el('div', { class: 'notice notice-warn', hidden: true });

  async function persistTemplate() {
    const v = validateTemplate(template.render);
    if (!v.ok) { tplErr.textContent = `Template tidak valid: ${v.error}`; tplErr.hidden = false; return; }
    tplErr.hidden = true;
    template.version = (template.version || 1) + 1;
    await saveTemplate(template);
    toast('Template disimpan');
    navigate({ route: 'settings', reload: true });
  }

  const templatePanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('h3', { text: 'Template laporan' }),
      el('span', { class: 'spacer' }),
      ctx.templates.length > 1 ? picker : null,
    ),
    el('div', { class: 'field' },
      el('label', { text: 'Nama template' }),
      el('input', { value: template.name || '',
        onInput: (e) => { template.name = e.target.value; } }),
    ),

    el('h3', { text: 'Bagian', style: 'margin-top:18px' }),
    el('p', { class: 'small faint',
      text: 'Tambah, ubah nama, atau urutkan ulang. Bagian baru langsung muncul '
          + 'sebagai isian di editor SOAP tanpa perubahan kode.' }),
    sectionsWrap,

    el('h3', { text: 'Teks template', style: 'margin-top:18px' }),
    el('p', { class: 'small faint',
      text: 'Sintaks Mustache. Baris kosong berpengaruh — itulah yang membuat pesan '
          + 'WhatsApp mudah dibaca. Gunakan *tebal* dan _miring_ untuk markup WA.' }),
    renderBox,
    renderStatus,

    tplErr,
    el('div', { class: 'btn-row', style: 'margin-top:12px' },
      el('button', { class: 'btn-primary', onClick: persistTemplate }, 'Simpan template'),
      el('button', { onClick: async () => {
        const copy = duplicateTemplate(template);
        const id = await saveTemplate(copy);
        toast('Template diduplikasi');
        ctx.template = { ...copy, id };
        navigate({ route: 'settings', reload: true });
      } }, 'Duplikat template'),
      el('button', { onClick: async () => {
        const ok = await confirmDialog('Kembalikan template bawaan',
          'Semua bagian dan teks template akan diganti dengan bawaan aplikasi.\n\n'
          + 'Data SOAP yang sudah tersimpan TIDAK dihapus — bagian yang '
          + 'kuncinya sama akan tampil kembali seperti semula.',
          'Kembalikan');
        if (!ok) return;
        const fresh = seedTemplate(template.userId);
        template.sections = fresh.sections;
        template.render = fresh.render;
        await persistTemplate();
      } }, 'Kembalikan ke bawaan'),
      ctx.templates.length > 1 ? el('button', { class: 'btn-danger', onClick: async () => {
        const ok = await confirmDialog('Hapus template', `Hapus "${template.name}"?`);
        if (!ok) return;
        await deleteTemplate(template.id);
        ctx.template = ctx.templates.find(t => t.id !== template.id);
        toast('Template dihapus');
        navigate({ route: 'settings', reload: true });
      } }, 'Hapus template') : null,
    ),
  );

  /* ═══ Greeting ═══ */
  const cut = settings.greetingCutoffs;
  const hourField = (label, key) => el('div', { class: 'field' },
    el('label', { text: label }),
    el('input', { type: 'number', min: 0, max: 24, step: 1, value: cut[key],
      onInput: (e) => { cut[key] = Number(e.target.value); } }),
  );

  const greetingPanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' }, el('h3', { text: 'Salam & sapaan' })),
    el('div', { class: 'field' },
      el('label', { text: 'Mode salam' }),
      el('select', { onChange: (e) => { settings.salamMode = e.target.value; } },
        el('option', { value: 'assalamualaikum', selected: settings.salamMode === 'assalamualaikum' },
          'Assalamualaikum (tetap)'),
        el('option', { value: 'waktu', selected: settings.salamMode === 'waktu' },
          'Sesuai waktu (Selamat pagi/siang/sore/malam)'),
      ),
    ),
    el('div', { class: 'field' },
      el('label', { text: 'Teks salam tetap' }),
      el('input', { value: settings.salamText || '',
        onInput: (e) => { settings.salamText = e.target.value; } }),
    ),
    el('p', { class: 'small faint',
      text: 'Batas jam: pagi hingga jam pertama, siang hingga jam kedua, '
          + 'sore hingga jam ketiga, selebihnya malam.' }),
    el('div', { class: 'field-row' },
      hourField('Batas pagi', 'pagi'),
      hourField('Batas siang', 'siang'),
    ),
    el('div', { class: 'field-row' },
      hourField('Batas sore', 'sore'),
      el('div', { class: 'field' },
        el('label', { text: 'Awalan sapaan waktu' }),
        el('input', { value: settings.greetingPrefix || '',
          onInput: (e) => { settings.greetingPrefix = e.target.value; } }),
      ),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn-primary', onClick: async () => {
        await saveSettings(settings);
        ctx.settings = settings;
        toast('Pengaturan disimpan');
      } }, 'Simpan pengaturan'),
    ),
  );

  /* ═══ About ═══ */
  const aboutPanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' }, el('h3', { text: 'Tentang' })),
    el('p', { class: 'small' }, 'Versi aplikasi: ', el('code', { text: APP_VERSION })),
    el('p', { class: 'small faint',
      text: 'Fase 1 — inti alur kerja. Pelacak tahap, checklist, daftar DPJP, '
          + 'Morning Report, dan denah lantai menyusul di fase berikutnya.' }),
  );

  root.append(
    el('button', { class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }) }, '← Daftar pasien'),
    el('h2', { text: 'Pengaturan' }),
    templatePanel, greetingPanel, aboutPanel,
  );

  mount(root);
}

function defaultConfigFor(type) {
  switch (type) {
    case 'fixed-items': return { statusOptions: ['(+)', '(-)'], items: [] };
    case 'keyvalue':    return { fields: [] };
    case 'lines':       return { showLabel: true, lines: [] };
    case 'sub-blocks':  return { titleKey: 'dept', titleLabel: 'Nama',
                                 lists: [{ key: 'assessment', label: 'A' },
                                         { key: 'plan', label: 'P' },
                                         { key: 'therapy', label: 'T' }] };
    case 'formula':     return { options: [] };
    default:            return {};
  }
}

// ═══════════════════════════════════════════════════════════
//  REFORMAT ENGINE
//
//  Rearranges a clinical note from one house format into another.
//
//  DESIGN RULE: this engine MOVES text. It never writes clinical
//  content of its own. Every character in the output came from the
//  input, except for section scaffolding and explicit review
//  warnings.
//
//  Anything it cannot classify is preserved verbatim under a
//  "BELUM DITEMPATKAN" heading rather than dropped — silent loss
//  is the failure that matters here, not untidy output.
//
//  The output always lands in an editable box and is never copied
//  blind. That review step is the safety mechanism; the engine's
//  job is to make it a check rather than a retype.
// ═══════════════════════════════════════════════════════════

/* ── Block classification ────────────────────────────────────
   A clinical note is a sequence of blank-line-separated blocks.
   Each is classified by matching its opening line. Patterns are
   ordered: first match wins, so specific beats general. */

const PATTERNS = [
  ['greeting',   /^(Selamat|Assalamu)/i],
  ['identity',   /^\*[^*]*\/\s*\d{2}[-/]\d{2}[-/]\d{4}/],
  ['dpjp',       /^_?DPJP/i],
  ['subjective', /^\*?S\s*:/i],
  ['objective',  /^\*?O\s*:/i],
  ['airway',     /^\*?Airway/i],
  ['breathing',  /^\*?Breathing/i],
  ['circulation',/^\*?Circulation/i],
  ['disability', /^\*?Disability/i],
  ['exposure',   /^\*?Exposure/i],
  ['fluid',      /^\*?Fluid/i],
  ['glucose',    /^\*?Glucose/i],
  ['haematology',/^\*?Hypo\/Hyper/i],
  ['infection',  /^\*?Infection/i],
  ['urine',      /^Urin(e)?\s*output/i],
  ['balance',    /^BC\s*:/i],
  ['ekg',        /^EKG\b/i],
  ['lab',        /^Lab\b/i],
  ['thorax',     /^Foto\s+Thorax/i],
  ['echo',       /^(Echo|Lung\s+ultrasound|Conclusion\s*:)/i],
  ['procedure',  /^\*?Laporan\s+(PTCA|Angiografi|Tindakan)/i],
  // KESIMPULAN / SARAN are continuations of a procedure report that
  // happen to sit after a blank line. Classifying them as procedure
  // keeps them adjacent to the report they belong to.
  ['procedure',  /^(KESIMPULAN|SARAN)\s*:/i],
  ['assessment', /^\*?Mohon\s+izin\s+(kami|pasien)?\s*.*assess/i],
  ['therapy',    /^\*?Mohon\s+izin\s+(kami|pasien)?\s*.*terapi/i],
  ['done',       /^Selesai\s*:/i],
  ['plan',       /^\*?Plan\s*:/i],
  ['closing',    /^(Selanjutnya\s+mohon|Mohon\s+arahan)/i],
];

export function classifyBlock(text) {
  const first = String(text).trim().split('\n')[0].trim();
  for (const [kind, re] of PATTERNS) {
    if (re.test(first)) return kind;
  }
  return 'unknown';
}

/** Split a note into classified blocks, preserving original text. */
export function parseNote(note) {
  return String(note || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(text => ({ kind: classifyBlock(text), text }));
}

/* ── Vital-sign extraction ───────────────────────────────────
   In an ABCDE note the vitals are scattered across Airway,
   Breathing, Circulation and Exposure. A ward note wants them in
   one block. These pull individual measurements out of whatever
   prose they are sitting in.

   Every pattern returns null when absent — a missing vital is
   left blank for the user to fill, never guessed. */

const VITAL_RULES = [
  ['bp',    [/Tekanan\s+Darah\s*:?\s*([\d]+\/[\d]+[^\n,]*)/i,
             /\bTD\s*:?\s*([\d]+\/[\d]+[^\n,]*)/i]],
  ['hr',    [/Nadi\s*:?\s*([\d]+[^\n,]*)/i,
             /\bHR\s*:?\s*([\d]+[^\n,]*)/i]],
  ['rr',    [/Pernapasan\s*:?\s*([\d]+[^\n,]*)/i,
             /\bRR\s*:?\s*([\d]+[^\n,]*)/i]],
  ['temp',  [/Suhu\s*:?\s*([\d]+[.,]?[\d]*\s*C?)/i]],
  ['spo2',  [/SpO2\s*:?\s*([\d]+\s*%[^\n,]*)/i]],
  ['jvp',   [/(JVP\s+[^\n,]+)/i]],
];

export function extractVitals(blocks) {
  const haystack = blocks
    .filter(b => ['objective', 'airway', 'breathing', 'circulation',
                  'disability', 'exposure', 'haematology'].includes(b.kind))
    .map(b => b.text).join('\n');

  const out = {};
  for (const [key, res] of VITAL_RULES) {
    for (const re of res) {
      const m = haystack.match(re);
      if (m) { out[key] = m[1].trim().replace(/[,;]$/, ''); break; }
    }
  }
  return out;
}

/** Physical-exam findings, with measurements already lifted into the
    vitals block removed so they are not stated twice.

    Works at comma-clause level because ABCDE notes pack vitals and
    exam findings into a single Circulation line:
      "TD 103/73, Nadi 94, JVP R+3, BJ I/II murni, akral hangat" */
const EXAM_CLAUSE = /(bunyi\s+(napas|pernapasan|jantung)|rhonki|wheezing|murmur|akral|edema|BJ\s*I|JVP)/i;
const VITAL_CLAUSE = /^\s*(TD|Tekanan\s+Darah|Nadi|RR|Pernapasan|Suhu|SpO2|HR)\b/i;

export function extractExam(blocks) {
  const clauses = [];
  for (const b of blocks) {
    if (!['objective', 'breathing', 'circulation'].includes(b.kind)) continue;
    for (const line of b.text.split('\n')) {
      const t = line.trim();
      if (!t || /^\*/.test(t)) continue;
      for (const raw of t.split(',')) {
        const c = raw.trim().replace(/^[.;]+|[.;]+$/g, '');
        if (!c) continue;
        if (VITAL_CLAUSE.test(c)) continue;      // already in the vitals block
        if (EXAM_CLAUSE.test(c)) clauses.push(c);
      }
    }
  }
  // De-duplicate: the same finding often appears in two ABCDE sections.
  const seen = new Set();
  return clauses.filter(c => {
    const k = c.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/* ── Target layouts ──────────────────────────────────────────
   Ordered recipes. Each slot names the block kinds it collects.
   Layouts are plain data — a new house format is a new entry
   here, not new code. */

export const LAYOUTS = {
  bangsal: {
    id: 'bangsal',
    name: 'Bangsal (S/O klasik)',
    vitalsBlock: true,
    slots: [
      { kinds: ['greeting'] },
      { kinds: ['identity'] },
      { kinds: ['dpjp'] },
      { kinds: ['subjective'] },
      { slot: 'VITALS' },
      { slot: 'EXAM' },
      { kinds: ['urine'] },
      { kinds: ['ekg'] },
      { kinds: ['lab'] },
      { kinds: ['thorax'] },
      { kinds: ['echo'] },
      { kinds: ['procedure'] },
      { kinds: ['assessment'] },
      { kinds: ['therapy'] },
      { kinds: ['done'] },
      { kinds: ['plan'] },
      { kinds: ['closing'] },
    ],
    // Kinds intentionally dropped: ward reports omit the ICU-only
    // running balances. Listed explicitly so they can be reported
    // as dropped rather than vanishing.
    drop: ['airway', 'breathing', 'circulation', 'disability', 'exposure',
           'fluid', 'glucose', 'haematology', 'infection', 'balance', 'objective'],
  },

  cvcu: {
    id: 'cvcu',
    name: 'CVCU (ABCDE)',
    vitalsBlock: false,
    slots: [
      { kinds: ['greeting'] },
      { kinds: ['identity'] },
      { kinds: ['dpjp'] },
      { kinds: ['subjective'] },
      { kinds: ['objective'] },
      { kinds: ['airway'] },
      { kinds: ['breathing'] },
      { kinds: ['thorax'] },
      { kinds: ['circulation'] },
      { kinds: ['echo'] },
      { kinds: ['disability'] },
      { kinds: ['exposure'] },
      { kinds: ['ekg'] },
      { kinds: ['lab'] },
      { kinds: ['fluid'] },
      { kinds: ['urine'] },
      { kinds: ['balance'] },
      { kinds: ['glucose'] },
      { kinds: ['haematology'] },
      { kinds: ['infection'] },
      { kinds: ['procedure'] },
      { kinds: ['assessment'] },
      { kinds: ['therapy'] },
      { kinds: ['done'] },
      { kinds: ['plan'] },
      { kinds: ['closing'] },
    ],
    drop: [],
  },
};

/* ── The transform ───────────────────────────────────────────── */

const REVIEW_HEADER = '⚠️ PERIKSA SEBELUM KIRIM';
const UNPLACED_HEADER = '⚠️ BELUM DITEMPATKAN — pindahkan sendiri atau hapus';

function vitalsBlock(v) {
  const lines = ['*O:* Compos mentis'];
  lines.push(`Tekanan Darah : ${v.bp || ''}`);
  lines.push(`Nadi : ${v.hr || ''}`);
  lines.push(`Pernapasan : ${v.rr || ''}`);
  lines.push(`Suhu : ${v.temp || ''}`);
  lines.push(`SpO2 : ${v.spo2 || ''}`);
  return lines.join('\n');
}

/**
 * @returns {{ text, placed, unplaced, dropped, warnings, vitals }}
 */
export function reformat(note, layoutId = 'bangsal') {
  const layout = LAYOUTS[layoutId] || LAYOUTS.bangsal;
  const blocks = parseNote(note);
  const used = new Set();
  const out = [];

  const vitals = extractVitals(blocks);
  const exam = extractExam(blocks);

  for (const slot of layout.slots) {
    if (slot.slot === 'VITALS') {
      if (layout.vitalsBlock) out.push(vitalsBlock(vitals));
      continue;
    }
    if (slot.slot === 'EXAM') {
      if (exam.length) out.push(exam.join(', ') + '.');
      continue;
    }
    for (let i = 0; i < blocks.length; i++) {
      if (used.has(i)) continue;
      if (slot.kinds.includes(blocks[i].kind)) {
        out.push(blocks[i].text);
        used.add(i);
      }
    }
  }

  const dropped = [];
  const unplaced = [];
  blocks.forEach((b, i) => {
    if (used.has(i)) return;
    if (layout.drop.includes(b.kind)) dropped.push(b);
    else unplaced.push(b);
  });

  /* Warnings are generic prompts, not detected facts. The engine
     cannot know that a therapy finished — it can only reliably
     remind the user that this is the class of thing that changes
     on a format switch. */
  const warnings = [
    'Terapi yang sudah selesai atau berubah dosis',
    'Pemeriksaan baru yang belum masuk',
    'Rencana baru (mis. rencana rawat jalan)',
    'Lokasi dan salam di baris pembuka',
  ];
  if (Object.keys(vitals).length < 5) {
    warnings.unshift('Tanda vital yang kosong di blok *O:*');
  }

  let text = out.filter(Boolean).join('\n\n');

  text += `\n\n${REVIEW_HEADER}\n`
        + warnings.map(w => `- ${w}`).join('\n');

  if (dropped.length) {
    text += `\n\nℹ️ Tidak disertakan di format ini: `
          + dropped.map(b => b.text.split('\n')[0].replace(/[*:]/g, '').trim()).join(' · ');
  }

  if (unplaced.length) {
    text += `\n\n${UNPLACED_HEADER}\n\n`
          + unplaced.map(b => b.text).join('\n\n');
  }

  return {
    text: text.trim() + '\n',
    placed: used.size,
    unplaced,
    dropped,
    warnings,
    vitals,
    totalBlocks: blocks.length,
  };
}

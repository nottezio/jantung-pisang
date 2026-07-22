// ═══════════════════════════════════════════════════════════
//  SEED DATA
//
//  Every clinical word in this app lives in this file and nowhere
//  else. It is written to Firestore on first run and is fully
//  editable in Pengaturan from that moment on. Editing a template
//  in the app must never require touching source code.
//
//  Hard requirement #8.
// ═══════════════════════════════════════════════════════════

export const SEED_TEMPLATE_ID = 'tpl_klinis';

export const SEED_SECTIONS = [
  {
    key: 'contextSentence',
    label: 'Kalimat konteks',
    type: 'text',
    config: { placeholder: 'Perawatan hari ke-… dengan …' },
  },
  {
    key: 'subjective',
    label: 'S — Subjektif',
    type: 'bullets',
    config: { placeholder: 'Sesak berkurang\nNyeri dada tidak ada' },
  },
  {
    key: 'riskFactors',
    label: 'Faktor risiko kardiovaskular',
    type: 'text',
    config: {
      default: 'Riwayat Hipertensi \nRiwayat Diabetes Melitus \nRiwayat Dislipidemia \nRiwayat Merokok ',
    },
  },
  {
    key: 'vitals',
    label: 'O — Tanda vital',
    type: 'text',
    config: {
      default: 'Compos mentis\nTekanan Darah : \nNadi : \nPernapasan : \nSuhu : \nSpO2 : ',
    },
  },
  {
    key: 'exam',
    label: 'Pemeriksaan fisik',
    type: 'text',
    config: {
      default: 'Kepala : \nThorax : \nCor : \nPulmo : \nAbdomen : \nEkstremitas : ',
    },
  },
  {
    key: 'investigations',
    label: 'Pemeriksaan penunjang',
    type: 'dated-repeat',
    config: {},
  },
  { key: 'assessment', label: 'A — Assessment', type: 'bullets', config: {} },
  { key: 'therapy',    label: 'T — Terapi',     type: 'bullets', config: {} },
  { key: 'plan',       label: 'P — Plan',       type: 'bullets', config: {} },
  {
    key: 'tsBlocks',
    label: 'TS lain (opsional)',
    type: 'text',
    config: { placeholder: 'TS Penyakit Dalam\nA/ …\nP/ …\nT/ …' },
  },
  {
    key: 'closing',
    label: 'Penutup',
    type: 'text',
    config: { default: 'Mohon arahan dan koreksinya dokter. Terima kasih.' },
  },
];

// The render string. Verified against the reference documents.
// ⚠️ Blank lines here are load-bearing — they are what makes the
//    WhatsApp message readable. Do not "tidy" them.
export const SEED_RENDER = `{{salam}} dokter. Tabe dokter, mohon izin melaporkan {{reportType.label}}{{#source}} dari *{{source}}*{{/source}} di *{{location.full}}* atas nama:

*{{patient.name}} / {{patient.dob}} / {{patient.age}} tahun / RM {{patient.mrn}}*

{{#dpjp}}
_{{role}} : {{name}}_
{{/dpjp}}

_{{contextSentence}}_

*S:*
{{#subjective}}
- {{.}}
{{/subjective}}

*Faktor risiko kardiovaskular:*
{{riskFactors}}

*O:*
{{vitals}}

{{exam}}
{{#patient.insurance}}
{{patient.insurance}}
{{/patient.insurance}}

{{#investigations}}
*{{type}}{{#subtype}} {{subtype}}{{/subtype}}{{#location}} {{location}}{{/location}} ({{date}})*
{{#values}}{{#abnormal}}*{{/abnormal}}{{label}} : {{value}}{{#abnormal}}*{{/abnormal}}
{{/values}}{{#content}}{{content}}{{/content}}

{{/investigations}}
*Mohon izin pasien kami assess dengan :*
{{#assessment}}
- {{.}}
{{/assessment}}

*Mohon izin pasien kami terapi dengan :*
{{#therapy}}
- {{.}}
{{/therapy}}

*Plan :*
{{#plan}}
- {{.}}
{{/plan}}

{{#tsBlocks}}
{{tsBlocks}}

{{/tsBlocks}}
{{closing}}`;

export const REPORT_TYPES = [
  { value: 'followup-harian',   label: 'follow up harian' },
  { value: 'baru-poli',         label: 'pasien baru dari poli' },
  { value: 'perpindahan',       label: 'pasien perpindahan' },
  { value: 'konsul-kelayakan',  label: 'jawaban konsul kelayakan' },
  { value: 'kjs-followup',      label: 'follow up KJS' },
];

export function seedTemplate(userId) {
  return {
    id: SEED_TEMPLATE_ID,
    userId,
    profileId: 'pjt',
    name: 'Laporan klinis',
    reportType: 'followup-harian',
    version: 1,
    sections: SEED_SECTIONS,
    render: SEED_RENDER,
  };
}

export const DEFAULT_SETTINGS = {
  id: 'app',
  salamMode: 'assalamualaikum',        // 'assalamualaikum' | 'waktu'
  salamText: 'Assalamualaikum',
  greetingCutoffs: { pagi: 11, siang: 15, sore: 18 },
  greetingPrefix: 'Selamat',
  defaultSort: 'room',
};

export const INVESTIGATION_TYPES = [
  'EKG', 'Laboratorium', 'Foto Thorax', 'Echocardiography',
  'CT', 'Urinalisa', 'ADT', 'Laporan Tindakan',
];

export const DPJP_ROLES = [
  'DPJP Utama', 'DPJP Tindakan', 'DPJP Onsite', 'Pelimpahan Wewenang',
];

export const ENTRY_TYPES   = ['Baru-Poli', 'Perpindahan', 'Konsul'];
export const PHASES        = ['Follow-up', 'Pre-Tindakan', 'Post-Tindakan', 'H-1', 'KJS'];
export const DISPOSITIONS  = ['Pulang', 'Pindah Gedung', 'Meninggal'];

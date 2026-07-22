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
    config: { placeholder: 'Keluhan…' },
  },
  {
    key: 'riskFactors',
    label: 'Faktor risiko kardiovaskular',
    type: 'fixed-items',
    config: {
      statusOptions: ['(+)', '(-)', 'tidak diketahui'],
      items: [
        { key: 'hipertensi',  label: 'Hipertensi' },
        { key: 'dm',          label: 'Diabetes Melitus' },
        { key: 'dislipidemia',label: 'Dislipidemia' },
        { key: 'merokok',     label: 'Merokok' },
      ],
    },
  },
  {
    key: 'vitals',
    label: 'Tanda vital',
    type: 'keyvalue',
    config: {
      fields: [
        { key: 'consciousness', label: 'Kesadaran', default: 'Sakit sedang / Compos mentis / Gizi cukup' },
        { key: 'bp',    label: 'Tekanan Darah', inputMode: 'numeric', placeholder: '120/80', suffix: 'mmHg' },
        { key: 'hr',    label: 'Nadi',          inputMode: 'numeric', suffix: 'kali/menit' },
        { key: 'rhythm',label: 'Irama nadi',    placeholder: 'reguler / ireguler' },
        { key: 'rr',    label: 'Pernapasan',    inputMode: 'numeric', suffix: 'kali/menit' },
        { key: 'temp',  label: 'Suhu',          inputMode: 'decimal', suffix: '°C' },
        { key: 'spo2',  label: 'SpO2',          inputMode: 'numeric', suffix: '%' },
        { key: 'support',label:'Alat bantu O2',  placeholder: 'udara bebas / NK 3 lpm' },
      ],
    },
  },
  {
    key: 'exam',
    label: 'Pemeriksaan fisik',
    type: 'lines',
    config: {
      showLabel: true,
      lines: [
        { key: 'kepala',  label: 'Kepala' },
        { key: 'thorax',  label: 'Thorax' },
        { key: 'cor',     label: 'Cor' },
        { key: 'pulmo',   label: 'Pulmo' },
        { key: 'abdomen', label: 'Abdomen' },
        { key: 'ekstremitas', label: 'Ekstremitas' },
      ],
    },
  },
  {
    key: 'anthro',
    label: 'Antropometri',
    type: 'keyvalue',
    config: {
      fields: [
        { key: 'weight', label: 'Berat badan', inputMode: 'decimal', suffix: 'kg' },
        { key: 'height', label: 'Tinggi badan', inputMode: 'decimal', suffix: 'cm' },
      ],
    },
  },
  {
    key: 'investigations',
    label: 'Pemeriksaan penunjang',
    type: 'dated-repeat',
    // Virtual: nothing is stored on the entry. The entry holds
    // includedInvestigationIds; the master list lives on the
    // patient. Hard requirement #4.
    config: {},
  },
  {
    key: 'riskStratification',
    label: 'Stratifikasi risiko',
    type: 'formula',
    config: {
      options: [
        { value: 'rcri_low',  label: 'Lee RCRI — risiko rendah',
          sentence: 'Lee RCRI: risiko rendah (< 1%)' },
        { value: 'rcri_high', label: 'Lee RCRI — risiko tinggi',
          sentence: 'Lee RCRI: risiko tinggi (≥ 1%)' },
        { value: 'icos_low',  label: 'HFA-ICOS — risiko rendah',
          sentence: 'HFA-ICOS: risiko rendah' },
        { value: 'icos_med',  label: 'HFA-ICOS — risiko sedang',
          sentence: 'HFA-ICOS: risiko sedang' },
        { value: 'icos_high', label: 'HFA-ICOS — risiko tinggi',
          sentence: 'HFA-ICOS: risiko tinggi' },
      ],
    },
  },
  { key: 'assessment', label: 'A — Assessment', type: 'bullets', config: {} },
  { key: 'therapy',    label: 'T — Terapi',     type: 'bullets', config: {} },
  { key: 'plan',       label: 'P — Plan',       type: 'bullets', config: {} },
  {
    key: 'tsBlocks',
    label: 'Blok TS (konsul)',
    type: 'sub-blocks',
    config: {
      titleKey: 'dept',
      titleLabel: 'Departemen',
      lists: [
        { key: 'assessment', label: 'A' },
        { key: 'plan',       label: 'P' },
        { key: 'therapy',    label: 'T' },
      ],
    },
  },
  {
    key: 'closing',
    label: 'Penutup',
    type: 'text',
    config: { placeholder: 'Mohon arahan dan koreksinya dokter. Terima kasih.' },
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
{{#riskFactors}}
- Riwayat {{label}} {{status}}{{#detail}}, {{detail}}{{/detail}}
{{/riskFactors}}

*O:*
{{vitals.consciousness}}
Tekanan Darah : {{vitals.bp}} mmHg
Nadi : {{vitals.hr}} kali/menit{{#vitals.rhythm}}, {{vitals.rhythm}}{{/vitals.rhythm}}
Pernapasan : {{vitals.rr}} kali/menit
Suhu : {{vitals.temp}} derajat Celcius
SpO2 : {{vitals.spo2}}% {{vitals.support}}

{{#exam}}
{{.}}
{{/exam}}

{{#anthro.weight}}BB {{anthro.weight}} kg{{/anthro.weight}}
{{#anthro.height}}TB {{anthro.height}} cm{{/anthro.height}}
{{#patient.insurance}}{{patient.insurance}}{{/patient.insurance}}

{{#investigations}}
*{{type}}{{#subtype}} {{subtype}}{{/subtype}}{{#location}} {{location}}{{/location}} ({{date}})*
{{#values}}{{#abnormal}}*{{/abnormal}}{{label}} : {{value}}{{#abnormal}}*{{/abnormal}}
{{/values}}{{#content}}{{content}}{{/content}}

{{/investigations}}
{{#riskStratification}}
*_{{riskStratification}}_*

{{/riskStratification}}
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
*TS {{dept}}*
A/
{{#assessment}}- {{.}}
{{/assessment}}
P/
{{#plan}}- {{.}}
{{/plan}}
T/
{{#therapy}}- {{.}}
{{/therapy}}

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

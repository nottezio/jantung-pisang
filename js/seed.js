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
    key: 'note',
    label: 'Catatan',
    type: 'text',
    // ONE BOX. The whole note is free text, the way a notes app
    // works. The skeleton below is only a starting point — it is
    // seed DATA, editable in Pengaturan, and the user can delete
    // any of it.
    //
    // WhatsApp markup (*bold*) lives in the skeleton rather than in
    // the render string, so what is typed is what is sent.
    config: {
      rows: 20,
      default:
        '*S:*\n- \n\n'
        + '*Faktor risiko kardiovaskular:*\n'
        + 'Riwayat Hipertensi \nRiwayat Diabetes Melitus \n'
        + 'Riwayat Dislipidemia \nRiwayat Merokok \n\n'
        + '*O:*\nCompos mentis\nTekanan Darah : \nNadi : \n'
        + 'Pernapasan : \nSuhu : \nSpO2 : \n\n'
        + '*A:*\n- \n\n'
        + '*T:*\n- \n\n'
        + '*P:*\n- \n\n'
        + 'Mohon arahan dan koreksinya dokter. Terima kasih.',
    },
  },
];

// The render string. Verified against the reference documents.
// ⚠️ Blank lines here are load-bearing — they are what makes the
//    WhatsApp message readable. Do not "tidy" them.
export const SEED_RENDER = `{{salam}} dokter. Tabe, mohon izin melaporkan {{reportType.label}}{{#previousLocation}} dari *{{previousLocation.full}}* ke{{/previousLocation}}{{^previousLocation}} di{{/previousLocation}} *{{location.full}}* atas nama:

*{{patient.name}} / {{patient.dob}} / {{patient.age}} tahun / RM {{patient.mrn}}*

{{#dpjp}}
_{{role}} : {{name}}_
{{/dpjp}}

{{note}}`;

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
  // Blank report formats for manual copying. Plain text, no
  // rendering. Seeded empty — the user pastes in their own.
  formats: [],

  // Workflow stages, as DATA so they can be renamed or trimmed in
  // Pengaturan without a code change. A profile with an empty array
  // hides the tracker entirely (Phase 5).
  stages: [
    'SOAP dibuat',
    'Kirim ke Chief',
    'SOAP dikoreksi',
    'Lapor DPJP',
    'Input SIMGOS',
    'Plan & terapi dilaksanakan',
  ],
};

export const INVESTIGATION_TYPES = [
  'EKG', 'Laboratorium', 'Foto Thorax', 'Echocardiography',
  'CT', 'Urinalisa', 'ADT', 'Laporan Tindakan',
];

export const REPORT_CHANNELS = [
  { value: 'viaChief',    label: 'Lewat Chief' },
  { value: 'viaChiefPDF', label: 'Lewat Chief (PDF)' },
  { value: 'pcAndGrup',   label: 'PC & grup' },
  { value: 'pcOnly',      label: 'PC saja' },
];

/* Seed for the DPJP registry — names and initials from the person's
   own list. Initials in brackets were absent from the source for a
   few entries and are derived from the name; they are editable.

   channelKnown marks the ten whose reporting route was actually
   observed. The rest default to 'viaChief' because going through
   the Chief is never wrong, only slower — a wrong direct-contact
   guess is worse than a conservative one. Unconfirmed entries are
   flagged in the UI. */
export const DPJP_SEED = [
  { initial: 'PK', name: 'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)',
    reportChannel: 'pcAndGrup', needsPDF: false, channelKnown: true },
  { initial: 'MZ', name: 'Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)',
    reportChannel: 'pcAndGrup', needsPDF: false, channelKnown: true },
  { initial: 'IM', name: 'Prof. Dr. dr. Idar Mappangara, Sp.PD, Sp.JP(K)',
    reportChannel: 'pcOnly', needsPDF: false, channelKnown: true },
  { initial: 'AHA', name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'ZD', name: 'dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP, Subsp.PRKV(K)',
    reportChannel: 'viaChiefPDF', needsPDF: true, channelKnown: true },
  { initial: 'AFM', name: 'Dr. dr. Akhtar Fajar Muzakkir, Sp.JP, Subsp. IKKV(K), KI(K)',
    reportChannel: 'viaChiefPDF', needsPDF: true, channelKnown: true },
  { initial: 'AHN', name: 'Dr. dr. Az Hafid Nashar, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: true },
  { initial: 'AFG', name: 'dr. Aussie Fitriani Ghaznawie, Sp.JP, Subsp.Eko (K)',
    reportChannel: 'viaChiefPDF', needsPDF: true, channelKnown: true },
  { initial: 'PT', name: 'dr. Pendrik Tandean, Sp.PD-KKV',
    reportChannel: 'pcAndGrup', needsPDF: false, channelKnown: true },
  { initial: 'KS', name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV',
    reportChannel: 'pcAndGrup', needsPDF: false, channelKnown: true },
  { initial: 'SM', name: 'Dr. dr. Sumarni, Sp.JP, Subsp.Ar (K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'MAA', name: 'dr. Muhammad Asrul Apris, Sp.JP(K)',
    reportChannel: 'pcOnly', needsPDF: false, channelKnown: true },
  { initial: 'YP', name: 'Dr. dr. Yulius Patimang, Sp.A, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'AAU', name: 'dr. Andi Alief Utama Armyn, M.Kes, Sp.JP, Subsp. KPPJB (K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'FM', name: 'dr. Fadillah Maricar, Sp.JP (K), FIHA',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'AL', name: 'dr. Almudai, Sp.PD, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'IS', name: 'dr. Irmarisyani Sudirman, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'AA', name: 'dr. Amelia Arindanie, Sp.JP',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'BPP', name: 'dr. Bogie Putra Palinggi, Sp.JP (K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'FAT', name: 'dr. Frizt Alfred Tandean, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'ARB', name: 'dr. Andi Renata Bastario, Sp.JP(K)',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'NP', name: 'dr. Nurminsyah P., Sp.JP',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'MNM', name: 'dr. Muhammad Nuralim Mallapasi, Sp.B, Sp.BTKV(K)VE',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
  { initial: 'JK', name: 'dr. Jayarasti Kusumanegara, Sp.BTKV(K)VE',
    reportChannel: 'viaChief', needsPDF: false, channelKnown: false },
];

export const DPJP_ROLES = [
  'DPJP Utama', 'DPJP Tindakan', 'DPJP Onsite', 'Pelimpahan Wewenang',
];

export const ENTRY_TYPES   = ['Baru-Poli', 'Perpindahan', 'Konsul'];
export const PHASES        = ['Follow-up', 'Pre-Tindakan', 'Post-Tindakan', 'H-1', 'KJS'];
export const DISPOSITIONS  = ['Pulang', 'Pindah Gedung', 'Meninggal'];

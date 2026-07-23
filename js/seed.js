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
export const SEED_RENDER = `{{salam}} dokter. Tabe dokter, mohon izin melaporkan {{reportType.label}}{{#source}} dari *{{source}}*{{/source}} di *{{location.full}}* atas nama:

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

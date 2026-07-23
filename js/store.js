// ═══════════════════════════════════════════════════════════
//  FIRESTORE DATA LAYER
//
//  Hard requirement #1: EVERY document carries userId, from the
//  first commit. There is one user today; there will be more.
//  Adding it later means a migration over live patient data.
//
//  Every read is scoped by where('userId','==',uid) so the client
//  query matches what the security rules allow — a query without
//  it is rejected outright rather than silently filtered.
// ═══════════════════════════════════════════════════════════
import {
  db, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp,
} from './fb.js';
import { clone, isoDate, uid } from './util.js';
import { normalizeSections, blankSections } from './schema.js';
import { seedTemplate, DEFAULT_SETTINGS, SEED_TEMPLATE_ID } from './seed.js';

let USER_ID = null;
export function setUser(u) { USER_ID = u?.uid || null; }
export function currentUserId() { return USER_ID; }

function requireUser() {
  if (!USER_ID) throw new Error('Belum masuk.');
  return USER_ID;
}

const col = (name) => collection(db, name);

/** Stamp ownership + timestamps on the way out. */
function outbound(data, { isNew }) {
  const payload = { ...data, userId: requireUser(), updatedAt: serverTimestamp() };
  if (isNew) payload.createdAt = serverTimestamp();
  delete payload.id;
  return payload;
}

const withId = (snap) => ({ id: snap.id, ...snap.data() });

/* ─────────────────────────────────────────────────────────────
   PATIENTS
   ───────────────────────────────────────────────────────────── */

export const BLANK_PATIENT = () => ({
  name: '', dob: '', gender: '', mrn: '', insurance: '',
  location: { ward: '', floor: '', room: '', bed: '' },
  dpjp: [],
  entryType: 'Baru-Poli',
  currentPhase: 'Follow-up',
  konsulSubtype: null,
  source: { dept: '', referringDoctor: '' },
  mainDiagnosis: '',
  admissionDate: isoDate(),
  admissionShift: suggestShift(),
  assignedTo: '',
  followUpExempt: false,
  stage: 0,                    // 0 = belum mulai; index into settings.stages
  stageDate: null,             // ISO date the stage was last touched
  disposition: null,           // Phase 1 writes this; Phase 5 generalises it
  investigations: [],          // MASTER list — hard requirement #4
});

/** Suggested, always editable. Ward convention: jaga outside
    office hours. */
function suggestShift(now = new Date()) {
  const h = now.getHours();
  return (h >= 7 && h < 14) ? 'dinas' : 'jaga';
}

export async function listPatients() {
  const q = query(col('patients'), where('userId', '==', requireUser()));
  const snap = await getDocs(q);
  return snap.docs.map(withId);
}

export async function getPatient(id) {
  const snap = await getDoc(doc(db, 'patients', id));
  if (!snap.exists()) return null;
  const data = withId(snap);
  // Defence in depth: rules already block this, but never render
  // a document that isn't ours.
  if (data.userId !== requireUser()) return null;
  return data;
}

export async function createPatient(data) {
  const ref = await addDoc(col('patients'), outbound(data, { isNew: true }));
  return ref.id;
}

export async function updatePatient(id, data) {
  await updateDoc(doc(db, 'patients', id), outbound(data, { isNew: false }));
}

export async function deletePatient(id) {
  // Entries are a separate collection; remove them too or they
  // become unreachable orphans.
  const entries = await listEntries(id);
  await Promise.all(entries.map(e => deleteDoc(doc(db, 'soapEntries', e.id))));
  await deleteDoc(doc(db, 'patients', id));
}

/* ── Workflow stage ──────────────────────────────────────────
   The stage is a daily cycle: it resets every morning. Rather than
   hooking entry creation to clear it, the stage is stamped with the
   date it was set and simply reads as 0 on any later day. No
   scheduled job, no migration, correct across timezones and after
   the app has been closed for a week. */

export function effectiveStage(patient, today) {
  if (!patient?.stageDate) return 0;
  return patient.stageDate === today ? (patient.stage || 0) : 0;
}

export async function setStage(patient, stage, today) {
  const next = { ...patient, stage, stageDate: today };
  await updatePatient(patient.id, next);
  patient.stage = stage;
  patient.stageDate = today;
  return next;
}

/* ── Investigations live on the patient document ─────────────
   Hard requirement #4. Adding tomorrow's EKG must never require
   re-entering yesterday's, and a SOAP entry never copies one. */

export const BLANK_INVESTIGATION = () => ({
  id: uid('inv_'), type: '', subtype: '', location: '',
  date: isoDate(), content: '', values: [],
});

export async function saveInvestigation(patient, inv) {
  const list = clone(patient.investigations || []);
  const i = list.findIndex(x => x.id === inv.id);
  if (i >= 0) list[i] = inv; else list.push(inv);
  await updatePatient(patient.id, { ...patient, investigations: list });
  return list;
}

export async function deleteInvestigation(patient, invId) {
  const list = (patient.investigations || []).filter(x => x.id !== invId);
  await updatePatient(patient.id, { ...patient, investigations: list });
  // Note: entries that referenced it simply stop resolving it.
  // References are cheap; we do not rewrite historical entries.
  return list;
}

/* ─────────────────────────────────────────────────────────────
   SOAP ENTRIES  —  PATIENT : ENTRY is ONE-TO-MANY
   Hard requirement #3. A ward patient is held for weeks and
   accumulates one dated entry per follow-up day.
   ───────────────────────────────────────────────────────────── */

export async function listEntries(patientId) {
  const q = query(
    col('soapEntries'),
    where('userId', '==', requireUser()),
    where('patientId', '==', patientId),
  );
  const snap = await getDocs(q);
  // Sorted client-side: avoids requiring a composite index, and
  // the per-patient set is small (weeks, not years).
  return snap.docs.map(withId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export async function getEntry(id) {
  const snap = await getDoc(doc(db, 'soapEntries', id));
  if (!snap.exists()) return null;
  const data = withId(snap);
  return data.userId === requireUser() ? data : null;
}

export function blankEntry(patientId, template) {
  return {
    patientId,
    date: isoDate(),
    reportType: template?.reportType || 'followup-harian',
    templateId: template?.id || SEED_TEMPLATE_ID,
    templateVersion: template?.version || 1,
    sections: blankSections(template),
    includedInvestigationIds: [],
  };
}

/**
 * CARRY-FORWARD — the primary daily action.
 *
 * Deep-clones the previous entry's sections map AND its
 * investigation selection. Because sections is an open map, this
 * is genuinely generic: it copies sections that did not exist
 * when this function was written, including ones the user added
 * this morning.
 */
export function carryForwardEntry(previous, template) {
  const base = blankEntry(previous.patientId, template);
  return {
    ...base,
    reportType: previous.reportType || base.reportType,
    sections: normalizeSections(clone(previous.sections || {}), template),
    includedInvestigationIds: clone(previous.includedInvestigationIds || []),
    carriedFromId: previous.id,
  };
}

export async function createEntry(data) {
  const ref = await addDoc(col('soapEntries'), outbound(data, { isNew: true }));
  return ref.id;
}

export async function updateEntry(id, data) {
  await updateDoc(doc(db, 'soapEntries', id), outbound(data, { isNew: false }));
}

export async function deleteEntry(id) {
  await deleteDoc(doc(db, 'soapEntries', id));
}

/* ─────────────────────────────────────────────────────────────
   TEMPLATES
   ───────────────────────────────────────────────────────────── */

export async function listTemplates() {
  const q = query(col('templates'), where('userId', '==', requireUser()));
  const snap = await getDocs(q);
  return snap.docs.map(withId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getTemplate(id) {
  const snap = await getDoc(doc(db, 'templates', id));
  if (!snap.exists()) return null;
  const data = withId(snap);
  return data.userId === requireUser() ? data : null;
}

export async function saveTemplate(tpl) {
  const id = tpl.id || uid('tpl_');
  await setDoc(doc(db, 'templates', id), outbound(tpl, { isNew: !tpl.id }), { merge: true });
  return id;
}

export async function deleteTemplate(id) {
  await deleteDoc(doc(db, 'templates', id));
}

/** Duplicate a template. Section keys are PRESERVED, not
    regenerated — a variant should stay compatible with entries
    written against the original, and the render string references
    those keys by name. */
export function duplicateTemplate(tpl) {
  const copy = clone(tpl);
  delete copy.id;
  copy.name = `${tpl.name || 'Template'} (salinan)`;
  copy.version = 1;
  return copy;
}

/* ─────────────────────────────────────────────────────────────
   DPJP REGISTRY
   ⛔ No password field, ever. Username only, if a system login
   must be referenced at all — hard requirement #2.
   ───────────────────────────────────────────────────────────── */

export const BLANK_DPJP = () => ({
  name: '', initial: '', titles: '',
  reportChannel: 'viaChief', needsPDF: false,
  notes: '', mrDays: [],
});

export async function listDpjp() {
  const q = query(col('dpjp'), where('userId', '==', requireUser()));
  const snap = await getDocs(q);
  return snap.docs.map(withId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function saveDpjp(d) {
  const id = d.id || uid('dpjp_');
  await setDoc(doc(db, 'dpjp', id), outbound(d, { isNew: !d.id }), { merge: true });
  return id;
}

export async function deleteDpjp(id) {
  await deleteDoc(doc(db, 'dpjp', id));
}

/* ─────────────────────────────────────────────────────────────
   SETTINGS
   ───────────────────────────────────────────────────────────── */

export async function getSettings() {
  const id = `app_${requireUser()}`;
  const snap = await getDoc(doc(db, 'settings', id));
  if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data(), id };
  return { ...DEFAULT_SETTINGS, id };
}

export async function saveSettings(settings) {
  const id = `app_${requireUser()}`;
  await setDoc(doc(db, 'settings', id), outbound(settings, { isNew: false }), { merge: true });
}

/* ─────────────────────────────────────────────────────────────
   FIRST RUN
   ───────────────────────────────────────────────────────────── */

/** Write the seed template once, on first sign-in. Idempotent. */
export async function ensureSeed() {
  const userId = requireUser();
  const existing = await listTemplates();
  if (existing.length) return existing;
  const tpl = seedTemplate(userId);
  await setDoc(doc(db, 'templates', SEED_TEMPLATE_ID), outbound(tpl, { isNew: true }));
  return [tpl];
}

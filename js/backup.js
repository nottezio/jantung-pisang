// ═══════════════════════════════════════════════════════════
//  BACKUP — export / import
//
//  Everything in this app lives in exactly one Firestore project.
//  Months of clinical notes with no second copy is the largest
//  unmitigated risk in the whole system, and it is the cheapest
//  one to remove.
//
//  Scope, per the spec: the app's OWN export, re-imported, must
//  round-trip safely. Parsing arbitrary free-text documents into
//  patient records is permanently out of scope — a silent parse
//  error in a clinical record is a patient-safety problem, not an
//  inconvenience.
// ═══════════════════════════════════════════════════════════
import {
  db, collection, doc, getDocs, setDoc, query, where, serverTimestamp,
} from './fb.js';
import { currentUserId } from './store.js';
import { APP_VERSION } from './version.js';

const COLLECTIONS = ['patients', 'soapEntries', 'templates', 'settings', 'dpjp'];
export const BACKUP_FORMAT = 1;

/* ── Export ─────────────────────────────────────────────────── */

async function dumpCollection(name, uid) {
  const snap = await getDocs(query(collection(db, name), where('userId', '==', uid)));
  return snap.docs.map(d => {
    const data = { ...d.data(), id: d.id };
    // Firestore Timestamps do not survive JSON. Convert to ISO so a
    // round trip preserves ordering rather than emitting {}.
    for (const k of ['createdAt', 'updatedAt']) {
      if (data[k]?.toDate) data[k] = data[k].toDate().toISOString();
    }
    return data;
  });
}

export async function exportAll() {
  const uid = currentUserId();
  if (!uid) throw new Error('Belum masuk.');

  const data = {};
  for (const name of COLLECTIONS) data[name] = await dumpCollection(name, uid);

  return {
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    // The uid is recorded for provenance only. On import every
    // document is re-stamped with the CURRENT user's uid, so a
    // backup can be restored into a different account without
    // hand-editing, and can never write into someone else's.
    exportedByUid: uid,
    counts: Object.fromEntries(COLLECTIONS.map(c => [c, data[c].length])),
    data,
  };
}

export function downloadBackup(backup) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient-tracker-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}

/* ── Import ─────────────────────────────────────────────────── */

/** Structural check before anything is written. */
export function validateBackup(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return { ok: false, problems: ['Bukan file JSON yang valid.'] };
  if (raw.format !== BACKUP_FORMAT) {
    problems.push(`Format cadangan ${raw.format ?? '?'} tidak dikenal (diharapkan ${BACKUP_FORMAT}).`);
  }
  if (!raw.data || typeof raw.data !== 'object') {
    problems.push('Bagian "data" tidak ditemukan.');
    return { ok: false, problems };
  }
  for (const name of COLLECTIONS) {
    const rows = raw.data[name];
    if (rows == null) continue;
    if (!Array.isArray(rows)) { problems.push(`"${name}" bukan array.`); continue; }
    const noId = rows.filter(r => !r || !r.id).length;
    if (noId) problems.push(`${noId} dokumen di "${name}" tidak punya id.`);
  }
  return { ok: problems.length === 0, problems };
}

export function summarise(raw) {
  return COLLECTIONS.map(name => ({
    name,
    count: Array.isArray(raw?.data?.[name]) ? raw.data[name].length : 0,
  }));
}

const LABELS = {
  patients: 'Pasien', soapEntries: 'Catatan SOAP',
  templates: 'Template', settings: 'Pengaturan', dpjp: 'DPJP',
};
export const collectionLabel = (n) => LABELS[n] || n;

/**
 * Write a validated backup back into Firestore.
 *
 * Documents are restored under their original IDs with merge, so
 * re-importing the same file twice is a no-op rather than a
 * duplicate. Every document is re-stamped with the current uid —
 * the security rules require it, and it is what allows a restore
 * into a fresh account.
 *
 * @param onProgress called as (done, total)
 */
export async function importAll(raw, { onProgress } = {}) {
  const uid = currentUserId();
  if (!uid) throw new Error('Belum masuk.');

  const { ok, problems } = validateBackup(raw);
  if (!ok) throw new Error(problems.join(' '));

  const jobs = [];
  for (const name of COLLECTIONS) {
    for (const row of raw.data[name] || []) jobs.push([name, row]);
  }

  let done = 0;
  const failures = [];
  for (const [name, row] of jobs) {
    const { id, ...rest } = row;
    try {
      await setDoc(doc(db, name, id), {
        ...rest,
        userId: uid,                 // never trust the file's uid
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      failures.push({ name, id, code: err?.code || String(err) });
    }
    onProgress?.(++done, jobs.length);
  }

  return { total: jobs.length, restored: jobs.length - failures.length, failures };
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE BOOTSTRAP
//  Offline layers 2 and 3 of 3 (layer 1 is sw.js).
// ─────────────────────────────────────────────────────────────
import {
  initializeApp, getAuth, setPersistence, browserLocalPersistence,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from '../vendor/firebase.js';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);

// ── Firestore: current persistence API ──────────────────────
// enableIndexedDbPersistence() is deprecated. persistentLocalCache
// is the supported replacement; multi-tab manager keeps desktop +
// a second tab from fighting over the IndexedDB lease.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// ── Auth: boot from cached state ────────────────────────────
// The app must render from a cached session. If it blocked on a
// token refresh at startup, a hospital dead zone would lock the
// user out of their own patient list.
export const auth = getAuth(app);

export const authReady = setPersistence(auth, browserLocalPersistence)
  .catch(err => {
    // Offline, or storage unavailable. Do NOT treat as sign-out —
    // keep going with whatever session state exists.
    console.warn('[auth] persistence unavailable, continuing:', err?.code || err);
  });

export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from '../vendor/firebase.js';

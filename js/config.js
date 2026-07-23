// ─────────────────────────────────────────────────────────────
//  FIREBASE PROJECT CONFIG
//  Replace with your own project's values (Firebase Console →
//  Project settings → Your apps → Web app → SDK setup).
//
//  These values are NOT secrets — they identify the project, they
//  do not grant access. Access is controlled entirely by
//  firestore.rules. See README.md § Security.
//
//  ⛔ Never put a password, EMR credential or API secret in this
//     file, or anywhere else in this app. Hard requirement #2.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyAD8mR-HmQIATA-j3gbrbfAzoyfa1xrEeA",
  authDomain: "mks-p-tracker.firebaseapp.com",
  projectId: "mks-p-tracker",
  storageBucket: "mks-p-tracker.firebasestorage.app",
  messagingSenderId: "223814378248",
  appId: "1:223814378248:web:8d3a96bf7a0ae0b74802bd"
};

export const isConfigured = () =>
  !Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_ME'));

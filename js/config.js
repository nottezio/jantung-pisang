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
  apiKey:            'REPLACE_ME',
  authDomain:        'REPLACE_ME.firebaseapp.com',
  projectId:         'REPLACE_ME',
  storageBucket:     'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId:             'REPLACE_ME',
};

export const isConfigured = () =>
  !Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_ME'));

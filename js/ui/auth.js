// ─────────────────────────────────────────────────────────────
//  SIGN IN
// ─────────────────────────────────────────────────────────────
import { auth, signInWithEmailAndPassword } from '../fb.js';
import { el } from '../util.js';
import { mount } from './shell.js';
import { isConfigured } from '../config.js';

const MESSAGES = {
  'auth/invalid-email':      'Format email tidak valid.',
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/wrong-password':     'Email atau kata sandi salah.',
  'auth/user-not-found':     'Email atau kata sandi salah.',
  'auth/too-many-requests':  'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed':
    'Tidak ada koneksi. Masuk memerlukan jaringan sekali di awal; '
    + 'setelah itu aplikasi berjalan offline.',
};

export function renderSignIn() {
  const err = el('div', { class: 'notice notice-warn', hidden: true });
  const email = el('input', { type: 'email', autocomplete: 'username', required: true });
  const pass  = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const btn   = el('button', { class: 'btn-primary', type: 'submit' }, 'Masuk');

  const fail = (msg) => { err.textContent = msg; err.hidden = false; };

  const form = el('form', {
    onSubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Memeriksa…';
      try {
        await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
        // onAuthStateChanged in app.js takes over from here.
      } catch (ex) {
        fail(MESSAGES[ex?.code] || `Gagal masuk (${ex?.code || 'tidak diketahui'}).`);
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    },
  },
    el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
    el('div', { class: 'field' }, el('label', { text: 'Kata sandi' }), pass),
    err,
    btn,
  );

  const card = el('div', { class: 'card', style: 'max-width:420px;margin:8vh auto' },
    el('h2', { text: 'Masuk' }),
    el('p', { class: 'small muted' },
      'Data pasien hanya dapat diakses oleh akun ini.'),
    form,
  );

  if (!isConfigured()) {
    card.prepend(el('div', { class: 'notice notice-warn' },
      'Firebase belum dikonfigurasi. Isi js/config.js dengan data proyek Anda, '
      + 'lalu deploy firestore.rules sebelum memasukkan data pasien.'));
  }

  mount(card);
  email.focus();
}

// ═══════════════════════════════════════════════════════════
//  APP BOOTSTRAP & ROUTER
// ═══════════════════════════════════════════════════════════
import { APP_VERSION } from './version.js';
import { auth, authReady, onAuthStateChanged, signOut } from './fb.js';
import { $, $$ } from './util.js';
import { setUser, ensureSeed, listTemplates, getSettings } from './store.js';
import { watchConnectivity, loading, showError } from './ui/shell.js';
import { renderSignIn } from './ui/auth.js';
import { renderPatients } from './ui/patients.js';
import { renderPatientDetail } from './ui/patient-detail.js';
import { renderSettings } from './ui/settings.js';

/* Shared, reloaded on sign-in and after template edits. */
const ctx = { templates: [], template: null, settings: null };

let currentRoute = { route: 'patients' };

export function navigate(next) {
  currentRoute = { ...currentRoute, ...next };
  if (next.reload) {
    loadContext().then(() => draw()).catch(err =>
      showError('Gagal memuat data aplikasi.', err?.message));
    return;
  }
  draw();
}

function draw() {
  switch (currentRoute.route) {
    case 'patient':  return renderPatientDetail(currentRoute.id, ctx);
    case 'settings': return renderSettings(ctx);
    default:         return renderPatients();
  }
}

async function loadContext() {
  ctx.templates = await ensureSeed().then(() => listTemplates());
  const keep = ctx.template && ctx.templates.find(t => t.id === ctx.template.id);
  ctx.template = keep || ctx.templates[0] || null;
  ctx.settings = await getSettings();
}

/* ── Chrome ─────────────────────────────────────────────────── */

function wireChrome() {
  $('#year').textContent = String(new Date().getFullYear());
  $('#versionTag').textContent = APP_VERSION;   // visible build, requirement #9

  $$('#nav [data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate({ route: btn.dataset.route }));
  });
  $('#signOutBtn').addEventListener('click', async () => {
    await signOut(auth);
  });
}

function setSignedIn(on) {
  $('#nav').hidden = !on;
}

/* ── Boot ───────────────────────────────────────────────────── */

async function boot() {
  wireChrome();
  watchConnectivity();

  // Layer 1 of 3 offline layers. Registration failure is not
  // fatal — the app still runs online.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module' })
      .catch(err => console.warn('[sw] registration failed:', err));
  }

  // Never block the first paint on a token refresh. A hospital
  // dead zone must not lock the user out of their own patient list.
  await authReady;

  onAuthStateChanged(auth, async (user) => {
    setUser(user);
    if (!user) {
      setSignedIn(false);
      ctx.templates = []; ctx.template = null; ctx.settings = null;
      return renderSignIn();
    }
    setSignedIn(true);
    loading('Menyiapkan…');
    try {
      await loadContext();
      currentRoute = { route: 'patients' };
      draw();
    } catch (err) {
      showError('Gagal memuat data aplikasi. Periksa konfigurasi Firebase dan '
              + 'pastikan firestore.rules sudah di-deploy.', err?.message);
    }
  });
}

boot();

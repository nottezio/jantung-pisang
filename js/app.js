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

const ctx = { templates: [], template: null, settings: null };
let currentRoute = { route: 'patients' };

export function navigate(next) {
  currentRoute = { ...currentRoute, ...next };
  if (next.reload) {
    loadContext().then(draw).catch(reportLoadFailure);
    return;
  }
  draw();
}

function draw() {
  // Settings dereferences ctx.template. Without this guard a failed
  // load turns into an unhandled crash instead of a readable message.
  if (currentRoute.route === 'settings' && !ctx.template) {
    return showError(
      'Template belum termuat. Muat ulang halaman, lalu buka Pengaturan lagi.');
  }
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

/**
 * onAuthStateChanged fires as soon as a cached user is known, but the
 * auth token backing Firestore requests may not have propagated yet.
 * The first query then fails with permission-denied even though the
 * rules are correct. Retry briefly rather than surfacing an error the
 * user can clear just by clicking a nav button.
 */
async function loadContextWithRetry(attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      await loadContext();
      return;
    } catch (err) {
      const racy = err?.code === 'permission-denied'
                || err?.code === 'unauthenticated';
      if (!racy || i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
}

function reportLoadFailure(err) {
  // err.code is the single most diagnostic field Firebase gives us.
  // Never discard it.
  console.error('[load] failed:', err?.code, err);
  showError(
    'Gagal memuat data aplikasi. Periksa konfigurasi Firebase dan '
    + 'pastikan firestore.rules sudah di-deploy.',
    `${err?.code || 'unknown'}: ${err?.message || err}`,
  );
}

function wireChrome() {
  $('#year').textContent = String(new Date().getFullYear());
  $('#versionTag').textContent = APP_VERSION;

  $$('#nav [data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate({ route: btn.dataset.route }));
  });
  $('#signOutBtn').addEventListener('click', () => signOut(auth));
}

function setSignedIn(on) {
  $('#nav').hidden = !on;
}

async function boot() {
  wireChrome();
  watchConnectivity();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module' })
      .catch(err => console.warn('[sw] registration failed:', err));
  }

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
      await loadContextWithRetry();
      currentRoute = { route: 'patients' };
      draw();
    } catch (err) {
      reportLoadFailure(err);
    }
  });
}

boot();

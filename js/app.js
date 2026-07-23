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
import { openFormatLibrary } from './ui/formats.js';
import { renderDpjpRegistry } from './ui/dpjp-registry.js';
import { renderReformat } from './ui/reformat.js';

/* Shared, reloaded on sign-in and after template edits. */
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
    case 'dpjp':     return renderDpjpRegistry();
    case 'reformat': return renderReformat(ctx);
    default:         return renderPatients(ctx);
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
 * rules are correct.
 */
async function loadContextWithRetry(attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try { await loadContext(); return; }
    catch (err) {
      const racy = err?.code === 'permission-denied'
                || err?.code === 'unauthenticated';
      if (!racy || i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
}

function reportLoadFailure(err) {
  // err.code is the most diagnostic field Firebase gives us. Never drop it.
  console.error('[load] failed:', err?.code, err);
  showError(
    'Gagal memuat data aplikasi. Periksa konfigurasi Firebase dan '
    + 'pastikan firestore.rules sudah di-deploy.',
    `${err?.code || 'unknown'}: ${err?.message || err}`,
  );
}

/* ── Chrome ─────────────────────────────────────────────────── */

/* Theme: auto → light → dark. Stored locally, not in Firestore —
   it is a property of the device, not the account. The iPad in the
   ward and the laptop at home want different answers. */
const THEMES = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: '🌗', light: '☀️', dark: '🌙' };

function applyTheme(mode) {
  if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

function wireTheme() {
  let mode = 'auto';
  try { mode = localStorage.getItem('ptracker-theme') || 'auto'; } catch {}
  if (!THEMES.includes(mode)) mode = 'auto';
  applyTheme(mode);

  const btn = document.createElement('button');
  btn.className = 'btn-sm btn-ghost';
  btn.title = 'Ganti tema';
  btn.setAttribute('aria-label', 'Ganti tema');
  btn.textContent = THEME_LABEL[mode];
  btn.addEventListener('click', () => {
    mode = THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length];
    applyTheme(mode);
    btn.textContent = THEME_LABEL[mode];
    try { localStorage.setItem('ptracker-theme', mode); } catch {}
  });
  document.querySelector('.topbar .spacer')?.after(btn);
}

function wireChrome() {
  $('#year').textContent = String(new Date().getFullYear());
  $('#versionTag').textContent = APP_VERSION;   // visible build, requirement #9

  $$('#nav [data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate({ route: btn.dataset.route }));
  });
  $('#formatBtn').addEventListener('click', () => {
    if (!ctx.settings) return;
    openFormatLibrary(ctx);
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
  wireTheme();
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
      await loadContextWithRetry();
      currentRoute = { route: 'patients' };
      draw();
    } catch (err) {
      reportLoadFailure(err);
    }
  });
}

boot();

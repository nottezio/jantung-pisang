// ─────────────────────────────────────────────────────────────
//  MANAGER — reference data in one place
//
//  DPJP and Format were separate tabs answering the same question:
//  "who am I reporting to, and in what shape?" Splitting them meant
//  two lookups mid-round. They are sub-tabs here instead.
// ─────────────────────────────────────────────────────────────
import { el } from '../util.js';
import { mount } from './shell.js';
import { dpjpPanel } from './dpjp-registry.js';
import { formatPanel } from './formats.js';
import { navigate } from '../app.js';

let activeTab = 'dpjp';

export async function renderManager(ctx) {
  const host = el('div');

  const tabs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Bagian manajer' },
    ...[['dpjp', 'DPJP'], ['format', 'Format laporan']].map(([id, label]) =>
      el('button', {
        type: 'button',
        class: 'seg-btn' + (activeTab === id ? ' active' : ''),
        'aria-pressed': String(activeTab === id),
        onClick: () => { activeTab = id; renderManager(ctx); },
      }, label)),
  );

  mount(el('div', {},
    el('button', {
      class: 'btn-sm btn-ghost', style: 'margin-bottom:8px',
      onClick: () => navigate({ route: 'patients' }),
    }, '← Daftar pasien'),
    el('h2', { text: 'Manajer' }),
    tabs,
    host,
  ));

  if (activeTab === 'dpjp') await dpjpPanel(host);
  else formatPanel(host, ctx);
}

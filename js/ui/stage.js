// ─────────────────────────────────────────────────────────────
//  STAGE DOT TRACK
//
//  The tracker part of "patient tracker". Six taps, no fields.
//
//  Tap dot N   → set stage to N
//  Tap current → step back one (undo a mis-tap)
//
//  Deliberately no auto-advance: the app cannot observe whether a
//  Chief actually replied, and a status that lies is worse than no
//  status at all.
// ─────────────────────────────────────────────────────────────
import { el, isoDate, toast } from '../util.js';
import { effectiveStage, setStage } from '../store.js';

/**
 * @param opts.compact  smaller dots, no labels — for list cards
 * @param opts.onChange called after a successful write
 */
export function stageTrack(patient, ctx, opts = {}) {
  const stages = ctx.settings?.stages || [];
  if (!stages.length) return null;          // profile without a workflow

  const today = isoDate();
  const wrap = el('div', { class: 'stage-track' + (opts.compact ? ' compact' : '') });

  function draw() {
    wrap.replaceChildren();
    const current = effectiveStage(patient, today);

    const dots = el('div', { class: 'stage-dots' });
    stages.forEach((label, i) => {
      const n = i + 1;
      const done = n <= current;
      dots.append(el('button', {
        type: 'button',
        class: 'stage-dot' + (done ? ' done' : ''),
        title: `${n}. ${label}`,
        'aria-label': `${n}. ${label}${done ? ' — selesai' : ''}`,
        'aria-pressed': done ? 'true' : 'false',
        onClick: async (e) => {
          e.stopPropagation();
          const next = (current === n) ? n - 1 : n;
          try {
            await setStage(patient, next, today);
            draw();
            opts.onChange?.(next);
          } catch (err) {
            toast(`Gagal menyimpan tahap: ${err?.code || err?.message || err}`);
          }
        },
      }, done ? '●' : '○'));
    });

    wrap.append(dots);

    if (!opts.compact) {
      wrap.append(el('div', { class: 'small faint stage-label', text:
        current === 0
          ? 'Belum mulai — ketuk titik untuk menandai kemajuan'
          : `${current}/${stages.length} · ${stages[current - 1]}` }));
    }
  }

  draw();
  return wrap;
}

/** One-line summary for dense contexts. */
export function stageSummary(patient, ctx) {
  const stages = ctx.settings?.stages || [];
  if (!stages.length) return '';
  const current = effectiveStage(patient, isoDate());
  return current === 0 ? 'Belum mulai' : stages[current - 1];
}

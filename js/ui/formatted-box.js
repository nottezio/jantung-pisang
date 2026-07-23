// ─────────────────────────────────────────────────────────────
//  FORMATTED BOX — an editable textarea with a rendered preview
//
//  Two views over ONE piece of text:
//    Teks   — the real characters, editable
//    Tampil — WhatsApp markup rendered, read-only
//
//  The plain text is always the source of truth. The rendered view
//  is generated from it on every toggle and never written back.
//  A view that re-serialised its own HTML would quietly rewrite
//  the asterisks the report depends on, and the corruption would
//  only surface after the message was sent.
//
//  Editing therefore happens in Teks. Tampil is a proof-read step:
//  markup that did not pair up is visible immediately, because it
//  shows as a stray asterisk instead of bold text.
// ─────────────────────────────────────────────────────────────
import { el, waToHtml } from '../util.js';

/**
 * @param opts.value        initial text
 * @param opts.readonly     lock the Teks view
 * @param opts.minHeight    css height for both views
 * @param opts.placeholder
 * @param opts.onInput      called with the plain text on every edit
 * @param opts.startRendered open in Tampil rather than Teks
 * @returns {{ node, get, set, focus, setRendered }}
 */
export function formattedBox(opts = {}) {
  const minHeight = opts.minHeight || '340px';
  let rendered = !!opts.startRendered;

  const textView = el('textarea', {
    class: 'preview-box',
    spellcheck: 'false',
    readonly: opts.readonly || null,
    placeholder: opts.placeholder || '',
    'aria-label': opts.label || 'Teks',
    style: `min-height:${minHeight}`,
    onInput: (e) => opts.onInput?.(e.target.value),
  }, opts.value || '');

  const htmlView = el('div', {
    class: 'preview-box wa-render',
    style: `min-height:${minHeight}`,
    'aria-label': 'Tampilan WhatsApp',
    hidden: true,
  });

  const tabText = el('button', {
    type: 'button', class: 'seg-btn',
    onClick: () => setRendered(false),
  }, 'Teks');

  const tabShow = el('button', {
    type: 'button', class: 'seg-btn',
    title: 'Lihat seperti di WhatsApp — tidak bisa diedit',
    onClick: () => setRendered(true),
  }, 'Tampilan WA');

  function paint() {
    // Rebuilt from the plain text every time it is shown, so the
    // two views can never drift apart.
    htmlView.innerHTML = waToHtml(textView.value);
    htmlView.hidden = !rendered;
    textView.hidden = rendered;
    tabText.classList.toggle('active', !rendered);
    tabShow.classList.toggle('active', rendered);
    tabText.setAttribute('aria-pressed', String(!rendered));
    tabShow.setAttribute('aria-pressed', String(rendered));
  }

  function setRendered(on) {
    rendered = on;
    paint();
    if (!on && !opts.readonly) textView.focus();
  }

  paint();

  const node = el('div', {},
    el('div', { class: 'seg', role: 'group', 'aria-label': 'Mode tampilan' },
      tabText, tabShow),
    textView,
    htmlView,
  );

  return {
    node,
    get: () => textView.value,
    set: (v) => { textView.value = v ?? ''; paint(); },
    focus: () => textView.focus(),
    setRendered,
    textView,
  };
}

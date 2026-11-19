// Tilbakemeldingsskjema – havner hos administratoren under «Tilbakemeldinger».
import { h, modal, toast } from './util.js';
import { t } from './i18n.js';
import { backend } from './backend.js';

// who: { name, email } for innloggede lærere, ellers null (da kan man skrive navn selv).
export function feedbackDialog(who, page, onSent) {
  const msg = h('textarea', { rows: '6', maxlength: '2000', placeholder: t('fb.placeholder') });
  const name = who ? null : h('input', { type: 'text', maxlength: '80', placeholder: t('fb.namePh') });
  const err = h('p', { class: 'form-error' });
  let m;
  const send = async e => {
    const text = msg.value.trim();
    if (!text) { err.textContent = t('fb.empty'); return; }
    e.target.disabled = true;
    try {
      await backend.sendFeedback({
        message: text,
        name: who?.name || name?.value.trim() || null,
        email: who?.email || null,
        page,
      });
      m.close();
      toast(t('fb.thanks'), 'ok');
      onSent?.();
    } catch (ex) {
      err.textContent = t('common.error', { msg: ex?.message || ex });
      e.target.disabled = false;
    }
  };
  m = modal(t('fb.title'), h('div', { class: 'stack' },
    h('p', { class: 'muted' }, t('fb.intro')), msg, name, err), [
    h('button', { class: 'btn ghost', onclick: () => m.close() }, t('common.cancel')),
    h('button', { class: 'btn primary', onclick: send }, t('fb.send')),
  ]);
  setTimeout(() => msg.focus(), 50);
}

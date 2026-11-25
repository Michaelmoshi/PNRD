// Petits outils DOM : aucune insertion de HTML (tout passe par textContent, donc pas d'injection)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, children);
  return el;
}

function add(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el) => { el.replaceChildren(); return el; };

let toastTimer;
export function toast(message, kind = 'ok') {
  let box = document.getElementById('toast');
  if (!box) { box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  box.textContent = message;
  box.className = `toast toast--${kind} is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-visible'), kind === 'error' ? 6000 : 3000);
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '—');
export const mediaUrl = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) ? p : '/' + p.replace(/^\/+/, ''));

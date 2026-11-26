// Petits outils DOM : aucune insertion de HTML (tout passe par textContent, donc pas d'injection)
import { icon } from './icons.js';

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

let seq = 0;
export const uid = () => `f${++seq}`;

let toastTimer;
export function toast(message, kind = 'ok') {
  let box = document.getElementById('toast');
  if (!box) { box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  clear(box).append(icon(kind === 'ok' ? 'check' : 'shield'), h('span', null, message));
  box.className = `toast--${kind} is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-visible'), kind === 'error' ? 7000 : 3500);
}

// Saisie non enregistree : main.js demande confirmation avant de quitter la page
export const dirty = { on: false };

// Question en clair, avec des boutons qui disent ce qu'ils font. Renvoie true / false.
export function ask({ title, text, yes = 'Confirmer', no = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const dlg = h('dialog', { class: 'dialog dialog--small' },
      h('h2', null, title), text && h('p', null, text),
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', class: 'btn', autofocus: true, onclick: () => done(false) }, no),
        h('button', { type: 'button', class: `btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`, onclick: () => done(true) }, yes)));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Champ avec libelle, aide et emplacement pour un message d'erreur
export function field(label, input, { help, required } = {}) {
  const id = input.id || (input.id = uid());
  const error = h('p', { class: 'field-error', id: `${id}-err`, role: 'alert' });
  const wrap = h('div', { class: 'field' },
    h('label', { for: id }, label, required && h('span', { class: 'req' }, ' (obligatoire)')),
    input, help && h('p', { class: 'help' }, help), error);
  wrap.setError = (msg) => {
    error.textContent = msg || '';
    wrap.classList.toggle('has-error', !!msg);
    if (msg) input.setAttribute('aria-describedby', error.id); else input.removeAttribute('aria-describedby');
  };
  return wrap;
}

// Interrupteur oui / non
export function toggle(label, checked, onchange) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, onchange: () => onchange?.(input.checked) });
  const wrap = h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', { class: 'switch-label' }, label));
  wrap.input = input;
  return wrap;
}

export const back = (href, label = 'Retour') => h('a', { class: 'back', href }, icon('left'), label);

export const pageHead = (title, intro, action, crumb) => h('header', { class: 'page-head' },
  h('div', null, crumb && h('nav', { class: 'crumbs', 'aria-label': 'Fil d’Ariane' }, h('a', { href: crumb[0] }, crumb[1]), icon('right'), h('span', { 'aria-current': 'page' }, title)),
    h('h1', null, title), intro && h('p', { class: 'intro' }, intro)), action);

export const empty = (name, title, text, action) => h('div', { class: 'empty' }, icon(name, 'icon--xl'), h('h2', null, title), text && h('p', null, text), action);

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '—');
export const mediaUrl = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) ? p : '/' + p.replace(/^(\.\.\/|\/)+/, ''));

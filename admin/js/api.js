const BASE = '/api/v1/admin';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(method, url, body, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined && !opts.raw ? { 'Content-Type': 'application/json' } : opts.headers,
      body: body === undefined ? undefined : opts.raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Pas de connexion avec le serveur. Vérifiez votre internet et réessayez.');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* reponse inattendue : message generique ci-dessous */ }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(res.status, data?.error || 'Une erreur est survenue. Réessayez.');
  }
  // le contenu a change : la console met a jour l'indicateur « a publier »
  if (method !== 'GET' && /^\/(slides|programmes|events|agenda|members|member-categories|partners|content|settings|media|publish)/.test(url)) {
    window.dispatchEvent(new Event('content-changed'));
  }
  return data;
}

export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b ?? {});
export const patch = (u, b) => api('PATCH', u, b);
export const put = (u, b) => api('PUT', u, b);
export const del = (u) => api('DELETE', u);

export function upload(file, alt = '') {
  const q = new URLSearchParams({ name: file.name, alt });
  return api('POST', `/media?${q}`, file, { raw: true, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
}

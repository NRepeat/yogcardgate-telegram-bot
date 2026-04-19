const API_BASE = import.meta.env.DEV ? '' : window.location.origin;

let token = localStorage.getItem('admin_token') || '';

export function setToken(t: string) {
  token = t;
  localStorage.setItem('admin_token', t);
}

export function getToken() {
  return token;
}

export function clearToken() {
  token = '';
  localStorage.removeItem('admin_token');
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-API-TOKEN': token,
      ...opts.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

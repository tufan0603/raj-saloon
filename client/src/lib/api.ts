export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'saloonease_token';

export class ApiError extends Error {
  status: number;
  details?: { path: string; message: string }[];
  constructor(status: number, message: string, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const getToken = () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string) => window.localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
};

export function qs(query?: Options['query']) {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!opts.formData) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, {
      method: opts.method || (opts.body || opts.formData ? 'POST' : 'GET'),
      headers,
      body: opts.formData ? opts.formData : opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('saloonease:logout'));
    }
    throw new ApiError(res.status, data.message || `Request failed (${res.status})`, data.details);
  }
  return data as T;
}

/** Upload one or more files to Cloudinary through the API. */
export async function uploadFiles(files: File[], folder = 'misc') {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return api<{ media: import('./types').Media[]; file: import('./types').Media }>(`/admin/upload?folder=${folder}`, {
    method: 'POST',
    formData: fd,
  });
}

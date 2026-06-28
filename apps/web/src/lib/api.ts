const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface Session {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

export function saveSession(session: Session) {
  localStorage.setItem('session', JSON.stringify(session));
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('session');
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function clearSession() {
  localStorage.removeItem('session');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? 'Error de red');
  }
  return res.json() as Promise<T>;
}

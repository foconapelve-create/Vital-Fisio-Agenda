const SESSION_KEY = "vf_session_id";

export function getStoredSessionId(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

export function setStoredSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const sessionId = getStoredSessionId();
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "Authorization": `Bearer ${sessionId}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error ?? data?.message ?? message;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export default apiFetch;

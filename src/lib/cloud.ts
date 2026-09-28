/** Thin client for MRRmark cloud APIs. Token lives in localStorage. */

const TOKEN_KEY = 'ledger-cloud-token'

export function getCloudToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setCloudToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getCloudToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return data as T
}

export const cloud = {
  createWorkspace: (body: { name: string; role?: string; website?: string | null }) =>
    api<{ workspace: { id: string; name: string; slug: string; role: string }; accessToken: string; storage: string }>(
      '/api/workspace', { method: 'POST', body: JSON.stringify(body) },
    ),
  me: () => api<{
    workspace: { id: string; name: string; slug: string; role: string; website: string | null }
    stripe: { mode: string; status: string; accountEmail: string | null; lastSyncAt: string | null; lastError: string | null } | null
    trust: {
      publicSlug: string; isPublic: boolean; companyName: string; verifiedMrr: number; verifiedArr: number
      customerCount: number; source: string; lastVerifiedAt: string | null; publicUrl: string | null
    } | null
    files: { id: string; filename: string; kind: string; size: number; url: string; createdAt: string }[]
    storage: string
  }>('/api/workspace'),
  connectStripeKey: (secretKey: string) =>
    api<{ ok: boolean; mrr: number; arr: number; customerCount: number; currency: string; accountEmail: string | null; trust: { publicSlug: string; isPublic: boolean; publicUrl: string | null } }>(
      '/api/stripe', { method: 'POST', body: JSON.stringify({ secretKey, mode: 'key' }) },
    ),
  syncStripe: () => api<{ ok: boolean; mrr: number; arr: number }>('/api/stripe', { method: 'PUT' }),
  disconnectStripe: () => api<{ ok: boolean }>('/api/stripe', { method: 'DELETE' }),
  stripeOauthStart: () => api<{ oauth: boolean; authorizeUrl?: string; message?: string }>('/api/stripe'),
  publishTrust: (body: Record<string, unknown>) =>
    api<{ trust: { publicSlug: string; isPublic: boolean; publicUrl: string | null; embedUrl: string | null; verifiedMrr: number } }>(
      '/api/trust', { method: 'POST', body: JSON.stringify(body) },
    ),
  uploadFile: async (file: File, kind: string) => {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('kind', kind)
    return api<{ file: { id: string; filename: string; url: string } }>('/api/files', { method: 'POST', body: fd })
  },
  networkBenchmarks: (arr: number) =>
    api<{
      band: string
      static: { label: string; vals: Record<string, { median: number; top: number }> } | null
      network: { n: number; enough: boolean; medians: Record<string, number | null>; note: string }
    }>(`/api/benchmarks/network?arr=${encodeURIComponent(String(arr))}`),
}

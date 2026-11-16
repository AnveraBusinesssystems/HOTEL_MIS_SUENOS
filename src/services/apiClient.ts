const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim()

// Demo login lives entirely in the browser and therefore cannot authorize writes.
// Keep this false until a verified server-session flow is integrated throughout HMS.
const serverAuthenticated = false
const readActions = new Set([
  'summary.get', 'indicators.get', 'rms.get', 'reservations.get',
  'operation.get', 'cash.get', 'inventory.get', 'staff.get',
])

type ApiEnvelope<T> = {
  ok: boolean
  data?: T
  error?: { code?: string; message?: string }
}

export const apiClient = {
  isConfigured: Boolean(appsScriptUrl),
  canWrite: serverAuthenticated,

  async post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!appsScriptUrl) throw new Error('VITE_APPS_SCRIPT_URL no está configurada.')
    if (!readActions.has(action) && !serverAuthenticated) {
      throw new Error('Modo demostración: escrituras deshabilitadas hasta configurar autenticación real en el servidor.')
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)

    try {
      // text/plain keeps this as a CORS-simple request, avoiding a second preflight call.
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Apps Script respondió HTTP ${response.status}.`)

      const envelope = await response.json() as ApiEnvelope<T>
      if (!envelope.ok || envelope.data === undefined) {
        throw new Error(envelope.error?.message ?? 'Apps Script devolvió una respuesta inválida.')
      }
      return envelope.data
    } finally {
      window.clearTimeout(timeout)
    }
  },
}

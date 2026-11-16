const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim()

// No server-authenticated session exists yet. Only aggregate dashboard reads
// are enabled for connection testing. This is not a security boundary on Apps Script.
const serverAuthenticated = false
const aggregateReadActions = new Set(['summary.get', 'indicators.get', 'rms.get'])

type ApiEnvelope<T> = {
  ok: boolean
  data?: T
  error?: { code?: string; message?: string }
}

export const apiClient = {
  isConfigured: Boolean(appsScriptUrl),
  canReadPrivate: serverAuthenticated,
  canWrite: serverAuthenticated,

  async post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!appsScriptUrl) throw new Error('VITE_APPS_SCRIPT_URL no está configurada.')
    if (!serverAuthenticated && !aggregateReadActions.has(action)) {
      throw new Error('Acción protegida: solo Resumen, Indicadores y RMS permiten lectura temporal sin sesión verificada.')
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

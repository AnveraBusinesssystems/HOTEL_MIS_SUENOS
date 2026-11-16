const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim()

// Until HMS has server-side authentication, only aggregated reports may be read.
// Google Apps Script ContentService redirects POST responses; browsers often
// cannot read those redirects cross-origin. The read-only GET endpoint returns
// JSONP to an explicitly allowlisted script callback.
const serverAuthenticated = false
const aggregateReadActions = new Set(['summary.get', 'indicators.get', 'rms.get'])
const JSONP_TIMEOUT_MS = 30_000
let requestSequence = 0

type ApiEnvelope<T> = {
  ok: boolean
  data?: T
  error?: { code?: string; message?: string }
}

const readAggregate = <T,>(action: string, payload: Record<string, unknown>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (!appsScriptUrl) {
      reject(new Error('Falta VITE_APPS_SCRIPT_URL.'))
      return
    }

    const callback = '_hmsAggregate_' + Date.now() + '_' + (++requestSequence)
    const callbacks = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    const url = new URL(appsScriptUrl)
    url.searchParams.set('action', action)
    url.searchParams.set('callback', callback)
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue
      if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
        reject(new Error('Parámetro de lectura inválido.'))
        return
      }
      url.searchParams.set(key, String(value))
    }

    let completed = false
    let timer: number | undefined
    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      script.onerror = null
      script.remove()
      delete callbacks[callback]
    }
    const finish = (error?: Error, value?: T) => {
      if (completed) return
      completed = true
      cleanup()
      if (error) reject(error)
      else resolve(value as T)
    }
    callbacks[callback] = (envelope: ApiEnvelope<T>) => {
      if (!envelope || !envelope.ok || envelope.data === undefined) {
        finish(new Error(envelope?.error?.message || 'Apps Script devolvió una respuesta inválida.'))
      } else {
        finish(undefined, envelope.data)
      }
    }
    script.async = true
    script.onerror = () => finish(new Error(
      'No se pudo cargar Apps Script. Revisa el acceso del despliegue y publica la versión de Code.gs que incluye lectura GET.'
    ))
    timer = window.setTimeout(() => finish(new Error(
      'Apps Script no respondió en 30 segundos. Revisa las ejecuciones y vuelve a desplegar Code.gs con el endpoint GET.'
    )), JSONP_TIMEOUT_MS)
    script.src = url.toString()
    document.head.appendChild(script)
  })

export const apiClient = {
  isConfigured: Boolean(appsScriptUrl),
  canReadPrivate: serverAuthenticated,
  canWrite: serverAuthenticated,

  async post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!appsScriptUrl) throw new Error('VITE_APPS_SCRIPT_URL no está configurada.')

    if (!serverAuthenticated) {
      if (!aggregateReadActions.has(action)) {
        throw new Error('Acción protegida: solo Resumen, Indicadores y RMS permiten lectura temporal sin sesión verificada.')
      }
      return readAggregate<T>(action, payload)
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)

    try {
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const client = file('src/services/apiClient.ts')
const app = file('src/App.tsx')
const service = file('src/services/staffService.ts')
const backend = file('google-apps-script/Code.gs')
const personal = file('google-apps-script/Staff.gs')
const workflow = file('.github/workflows/deploy.yml')
const integration = file('src/services/staffIntegration.ts')

test('client permits aggregate live reads but protects private reads and all writes', () => {
  assert.match(client, /const serverAuthenticated = false/)
  assert.match(client, /aggregateReadActions = new Set\(\['summary.get', 'indicators.get', 'rms.get'\]\)/)
  assert.match(client, /if \(!aggregateReadActions.has\(action\)\)/)
  assert.match(client, /script\.src = url\.toString\(\)/)
  assert.match(client, /script\.onload/)
  assert.match(backend, /ContentService\.MimeType\.JAVASCRIPT/)
  assert.match(backend, /if \(\['summary.get','indicators.get','rms.get'\]\.indexOf\(request\.action\) < 0\)/)
  assert.match(client, /canWrite: serverAuthenticated/)
  assert.match(client, /canReadPrivate: serverAuthenticated/)
  assert.match(app, /const staffMode: StaffPersistence\['mode'\] = 'preview'/)
  assert.match(app, /system-demo-banner/)
  assert.match(app, /DATOS AGREGADOS EN VIVO/)
})

test('all staffService actions match Google Apps Script router actions', () => {
  const actions = [...service.matchAll(/'(?<action>staff\.[a-z.]+)'/g)].map(match => match.groups.action)
  assert.equal(actions.length, 8, 'Expected all eight Personal API methods')
  for (const action of actions) {
    assert.ok(backend.includes("case '" + action + "':"), 'Missing Apps Script route ' + action)
  }
})

test('server-side Personal route requires authenticated identity for every write', () => {
  for (const functionName of [
    'saveStaffEmployee_', 'setStaffStatus_', 'saveStaffSchedules_', 'deleteStaffSchedule_',
    'createStaffRequest_', 'reviewStaffRequest_', 'punchStaff_', 'getStaff_',
  ]) {
    assert.ok(personal.includes('function ' + functionName + '('), 'Missing ' + functionName)
  }
  assert.match(personal, /AUTH_NOT_CONFIGURED/)
  assert.match(personal, /staffAuth_\(req/)
  assert.match(personal, /LockService\.getScriptLock/)
  assert.match(integration, /mode: 'preview' \| 'live'/)
})

test('deployment blocks on synthetic tests and TypeScript build', () => {
  const testStep = workflow.indexOf('npm test')
  const buildStep = workflow.indexOf('npm run build')
  assert.ok(testStep > 0 && buildStep > testStep)
  assert.match(file('package.json'), /test:staff/)
})

test('production launch docs and demo warning exist', () => {
  assert.match(app, /DATOS AGREGADOS EN VIVO/)
  assert.match(file('src/staff-management.css'), /\.system-demo-banner/)
})

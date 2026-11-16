import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const empty = root('src/data/emptyData.ts')
const tours = root('src/components/ToursView.tsx')
const app = root('src/App.tsx')

test('initial dashboard is empty for every operational dataset', () => {
  const fields = [
    'performance','roomPerformance','rateDays','recommendations','rmsCalendar',
    'monthly','expenses','roomMonthly','reservations','roomStates','operationTasks',
    'operationDays','cleaningHistory','dailyOperation','tours','staff',
    'staffSchedules','staffTimeEntries','staffRequests','userAccounts',
    'cashMovements','cashDays','inventory','purchaseRequests','alerts',
  ]
  for (const field of fields) {
    assert.match(empty, new RegExp('\\b'+field+': \\[\\]'), field + ' must begin empty')
  }
})

test('tour form does not default to an invented tour provider', () => {
  assert.match(tours, /provider: ''/)
  assert.doesNotMatch(tours, /const providers =/)
  assert.match(tours, /Indica el proveedor real/)
  assert.match(tours, /Sin tours registrados/)
})

test('preview access must not be mistaken for a real hotel record', () => {
  assert.match(app, /ENTORNO DE DEMOSTRACIÓN/)
  assert.match(app, /const staffMode: StaffPersistence\['mode'\] = 'preview'/)
})

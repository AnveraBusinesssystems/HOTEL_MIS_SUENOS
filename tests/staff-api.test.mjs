import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'

const script = fs.readFileSync(new URL('../google-apps-script/Staff.gs', import.meta.url), 'utf8')
const headers = {
  PERSONAL: ['ID empleado','Nombre','Departamento','Puesto/Rol','Correo de acceso','Teléfono','Tipo de pago','Sueldo base','Horas semanales','Fecha de ingreso','Estado','Nota','Actualizado'],
  TURNOS_PERSONAL: ['ID turno','Semana (lunes)','Fecha','ID empleado','Nombre','Departamento','Tipo de jornada','Entrada','Salida','Descanso (min)','Horas programadas','Estado','ID solicitud','Nota','Actualizado'],
  SOLICITUDES_PERSONAL: ['ID solicitud','Fecha y hora','ID empleado','Nombre','Tipo de solicitud','Fecha afectada','Nueva fecha de descanso','Motivo','Estado','Resuelto por','Fecha de resolución','Nota de resolución','Actualizado'],
  ASISTENCIA_PERSONAL: ['ID registro','ID empleado','Fecha','Entrada real','Salida real','Descanso (min)','Horas trabajadas','Estado','Origen','Nota','Registrado por','Actualizado'],
}
const formatDate = (v, zone, fmt) => {
  const d = new Date(v)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(d).map(item => [item.type,item.value]))
  if (fmt==='yyyy-MM-dd') return [parts.year,parts.month,parts.day].join('-')
  if (fmt==='HH:mm') return [parts.hour,parts.minute].join(':')
  if (fmt==='yyyy-MM-dd HH:mm') return [parts.year,parts.month,parts.day].join('-')+' '+[parts.hour,parts.minute].join(':')
  throw new Error('Unmocked date format '+fmt)
}
function harness(role='Dueño', authenticated=true) {
  const sheets={}
  for(const [name,cols] of Object.entries(headers)) {
    const rows=Array.from({length:1000},()=>Array(cols.length).fill(''))
    rows[4]=cols.slice()
    if(name==='TURNOS_PERSONAL') for(let i=5;i<1000;i++) {
      rows[i][1]='=IF(C'+(i+1)+'="","",C'+(i+1)+'-WEEKDAY(C'+(i+1)+',2)+1)'
      rows[i][4]='=IFERROR(VLOOKUP(D'+(i+1)+',PERSONAL!$A$6:$D$1000,2,FALSE),"")'
      rows[i][5]='=IFERROR(VLOOKUP(D'+(i+1)+',PERSONAL!$A$6:$D$1000,3,FALSE),"")'
      rows[i][10]='=IF(G'+(i+1)+'<>"Trabajo", "",1)'
    }
    if(name==='SOLICITUDES_PERSONAL')for(let i=5;i<1000;i++)
      rows[i][3]='=IFERROR(VLOOKUP(C'+(i+1)+',PERSONAL!$A$6:$B$1000,2,FALSE),"")'
    sheets[name]={
      rows,
      getName:()=>name,
      getMaxRows:()=>1000,
      getRange(row,column,height=1,width=1) {
        const scan = () => Array.from({length:height},(_,i)=>rows[row+i-1].slice(column-1,column-1+width))
        return {
          getValues:scan, getDisplayValues:scan,
          getFormulas:()=>scan().map(row=>row.map(value=>typeof value==='string'&&value.startsWith('=')?value:'')),
          setValues(values) {
            values.forEach((line,i)=>line.forEach((value,j)=>{rows[row+i-1][column+j-1]=value}))
          },
          setValue(value){ rows[row-1][column-1]=value },
        }
      },
    }
  }
  const props=new Map()
  const cache=new Map()
  const ctx={
    Date, console, Number, String, Object, Array, Math, isFinite, JSON,
    HMS_CONFIG:{ SPREADSHEET_ID:'mock',TIME_ZONE:'America/Cancun'},
    SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets[name]})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    CacheService:{getScriptCache:()=>({
      get:key=>cache.get(key)||null, put:(key,value)=>cache.set(key,value), remove:key=>cache.delete(key),
    })},
    PropertiesService:{getScriptProperties:()=>({
      getProperty:key=>props.get(key)||null,
      setProperty:(key,value)=>props.set(key,value),
    })},
    Utilities:{formatDate,getUuid:()=>crypto.randomUUID()},
    todayKey_:()=> '2026-11-16',
  }
  if(authenticated)ctx.authenticateHmsRequest_=()=>({id:'USR-OWNER',employeeId:'EMP-001',role})
  vm.createContext(ctx)
  vm.runInContext(script,ctx,{filename:'Staff.gs'})
  const addEmployee = () => {
    const row=sheets.PERSONAL.rows[5]
    row[0]='EMP-001';row[1]='Prueba Ejemplo';row[2]='Recepción y Reservas';row[3]='Recepción'
    row[6]='Semanal';row[7]=2500;row[10]='Activo'
  }
  return {ctx,sheets,addEmployee}
}

test('Staff API fails closed without verified server authentication', () => {
  const {ctx}=harness('Dueño',false)
  assert.throws(()=>ctx.getStaff_({startDate:'2026-11-16',endDate:'2026-11-22'}),/AUTH_NOT_CONFIGURED/)
  assert.throws(()=>ctx.saveStaffSchedules_({entries:[]}),/AUTH_NOT_CONFIGURED/)
})

test('Only authorized management can edit salary or shifts', () => {
  const {ctx,addEmployee}=harness('Recepción')
  addEmployee()
  assert.throws(()=>ctx.saveStaffEmployee_({employee:{id:'EMP-001',name:'Prueba Ejemplo',role:'Recepción',weeklySalary:3000}}),/FORBIDDEN/)
  assert.throws(()=>ctx.saveStaffSchedules_({entries:[{employeeId:'EMP-001',date:'2026-11-16',isRest:true}]}),/FORBIDDEN/)
})

test('Schedule batch preserves formulas and prevents duplicates/invalid hours', () => {
  const {ctx,sheets,addEmployee}=harness()
  addEmployee()
  const input={employeeId:'EMP-001',date:'2026-11-17',isRest:false,shiftStart:'08:00',shiftEnd:'16:00'}
  const result=ctx.saveStaffSchedules_({entries:[input]})
  assert.equal(result.saved,1)
  assert.equal(sheets.TURNOS_PERSONAL.rows[5][6],'Trabajo')
  assert.match(sheets.TURNOS_PERSONAL.rows[5][1],/^=IF/)
  assert.match(sheets.TURNOS_PERSONAL.rows[5][4],/^=IFERROR/)
  assert.match(sheets.TURNOS_PERSONAL.rows[5][10],/^=IF/)
  assert.throws(()=>ctx.saveStaffSchedules_({entries:[input,input]}),/repetido/)
  assert.throws(()=>ctx.saveStaffSchedules_({entries:[{...input,shiftEnd:'07:00'}]}),/Horario inválido/)
})

test('Schedule cancellation preserves history and excludes cancelled rows from reads', () => {
  const {ctx,addEmployee}=harness()
  addEmployee()
  ctx.saveStaffSchedules_({entries:[{employeeId:'EMP-001',date:'2026-11-17',isRest:true}]})
  assert.equal(ctx.getStaff_({startDate:'2026-11-16',endDate:'2026-11-22'}).staffSchedules.length,1)
  ctx.deleteStaffSchedule_({employeeId:'EMP-001',date:'2026-11-17'})
  assert.equal(ctx.getStaff_({startDate:'2026-11-16',endDate:'2026-11-22'}).staffSchedules.length,0)
})

test('Requests are reviewed with server-side schedule validation', () => {
  const {ctx,addEmployee,sheets}=harness()
  addEmployee()
  ctx.saveStaffSchedules_({entries:[
    {employeeId:'EMP-001',date:'2026-11-18',isRest:true},
    {employeeId:'EMP-001',date:'2026-11-19',isRest:false,shiftStart:'08:00',shiftEnd:'16:00'},
  ]})
  const request=ctx.createStaffRequest_({request:{
    employeeId:'EMP-001',id:'SOL-test123',type:'Cambio de descanso',
    requestedDate:'2026-11-18',proposedDate:'2026-11-19',reason:'Cita',
  }}).request
  assert.equal(request.status,'Pendiente')
  const approved=ctx.reviewStaffRequest_({requestId:request.id,status:'Aprobada'}).request
  assert.equal(approved.status,'Aprobada')
  const shiftRows=sheets.TURNOS_PERSONAL.rows.slice(5,8)
  assert.equal(shiftRows[0][6],'Trabajo')
  assert.equal(shiftRows[1][6],'Descanso')
  assert.equal(ctx.reviewStaffRequest_({requestId:request.id,status:'Aprobada'}).alreadyReviewed,true)
})

test('Clock-in is idempotent against a second entry and exit requires an open shift', () => {
  const {ctx,addEmployee}=harness()
  addEmployee()
  ctx.saveStaffSchedules_({entries:[{employeeId:'EMP-001',date:'2026-11-16',isRest:false,shiftStart:'08:00',shiftEnd:'16:00'}]})
  const result=ctx.punchStaff_({employeeId:'EMP-001',kind:'in'}).entry
  assert.equal(result.employeeId,'EMP-001')
  assert.throws(()=>ctx.punchStaff_({employeeId:'EMP-001',kind:'in'}),/Entrada ya registrada/)
  const finished=ctx.punchStaff_({employeeId:'EMP-001',kind:'out'}).entry
  assert.ok(finished.clockOut)
  assert.throws(()=>ctx.punchStaff_({employeeId:'EMP-001',kind:'out'}),/No existe entrada abierta/)
})

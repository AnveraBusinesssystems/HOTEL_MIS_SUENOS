/**
 * HMS Personal connector — copy this file into the SAME Apps Script project.
 * All data is read from HMS_IW. Header row 5, data rows 6..1000.
 * FAIL CLOSED: requires a real, server-verified authenticateHmsRequest_ implementation.
 * Do NOT use the React demo login as authorization.
 */
var HMS_STAFF = Object.freeze({
  FIRST: 6, MAX: 1000, CACHE_SECONDS: 30, CACHE_PREFIX: 'hms:staff:v1:',
  COLS: { PERSONAL:13, TURNOS_PERSONAL:15, SOLICITUDES_PERSONAL:13, ASISTENCIA_PERSONAL:12 },
  HEADERS: {
    PERSONAL: ['ID empleado','Nombre','Departamento','Puesto/Rol','Correo de acceso','Teléfono','Tipo de pago','Sueldo base','Horas semanales','Fecha de ingreso','Estado','Nota','Actualizado'],
    TURNOS_PERSONAL: ['ID turno','Semana (lunes)','Fecha','ID empleado','Nombre','Departamento','Tipo de jornada','Entrada','Salida','Descanso (min)','Horas programadas','Estado','ID solicitud','Nota','Actualizado'],
    SOLICITUDES_PERSONAL: ['ID solicitud','Fecha y hora','ID empleado','Nombre','Tipo de solicitud','Fecha afectada','Nueva fecha de descanso','Motivo','Estado','Resuelto por','Fecha de resolución','Nota de resolución','Actualizado'],
    ASISTENCIA_PERSONAL: ['ID registro','ID empleado','Fecha','Entrada real','Salida real','Descanso (min)','Horas trabajadas','Estado','Origen','Nota','Registrado por','Actualizado']
  },
  ROLE_DEPT: {
    'Gerencia':'Gerencia','Administración':'Administración y Finanzas',
    'Recepción':'Recepción y Reservas','Cocina':'Alimentos y Bebidas / Cocina',
    'Limpieza':'Ama de Llaves / Limpieza','Alberca':'Mantenimiento y Alberca'
  }
});

function staffAuth_(req, manage, employeeId) {
  // This function must be supplied by a later, audited server authentication module.
  // No caller-controlled "role", "userId" or "employeeId" claim is trusted.
  if (typeof authenticateHmsRequest_ !== 'function')
    throw new Error('AUTH_NOT_CONFIGURED: configure login and server authorization first.');
  var principal = authenticateHmsRequest_(req);
  if (!principal || !principal.id || !principal.role) throw new Error('UNAUTHORIZED');
  var admin = ['Dueño','Gerencia','Administración'].indexOf(principal.role) >= 0;
  if (manage && !admin) throw new Error('FORBIDDEN');
  if (employeeId && !admin && String(principal.employeeId) !== String(employeeId)) throw new Error('FORBIDDEN');
  return {id:String(principal.id),employeeId:String(principal.employeeId||''),role:principal.role,admin:admin};
}

function staffBook_() { return SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID); }
function staffSheet_(ss, name) {
  var sh=ss.getSheetByName(name);
  if (!sh) throw new Error('Falta la hoja '+name);
  if (sh.getMaxRows()<HMS_STAFF.FIRST) throw new Error('Hoja sin filas para datos: '+name);
  var actual=sh.getRange(5,1,1,HMS_STAFF.COLS[name]).getDisplayValues()[0];
  HMS_STAFF.HEADERS[name].forEach(function(expected,i){
    if (String(actual[i]||'').trim()!==expected) throw new Error(name+': columna '+(i+1)+' diferente de '+expected);
  });
  return sh;
}
function staffRead_(sh,name) {
  var limit=Math.min(sh.getMaxRows(),HMS_STAFF.MAX);
  return sh.getRange(HMS_STAFF.FIRST,1,limit-HMS_STAFF.FIRST+1,HMS_STAFF.COLS[name]).getValues();
}
function staffText_(v) {return v===null||v===undefined?'':String(v).trim();}
function staffUserText_(v,max) {
  var value=staffText_(v);
  if(value.length>(max||500))throw new Error('Texto demasiado largo.');
  // Neutralize spreadsheet formula injection on ALL user-authored free text fields.
  if (/^[=+@]/.test(value)) value="'"+value;
  return value;
}
function staffDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v,HMS_CONFIG.TIME_ZONE,'yyyy-MM-dd');
  var s=staffText_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
}
function staffValidDate_(value) {
  var date=staffText_(value), m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if(!m) throw new Error('Fecha inválida: '+date);
  var d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));
  if(d.toISOString().slice(0,10)!==date) throw new Error('Fecha inexistente: '+date);
  return date;
}
function staffDateValue_(s) {return new Date(staffValidDate_(s)+'T12:00:00');}
function staffClock_(v) {
  if (v instanceof Date) return Utilities.formatDate(v,HMS_CONFIG.TIME_ZONE,'HH:mm');
  if (typeof v==='number') {var n=Math.round(v*1440)%1440;return ('0'+Math.floor(n/60)).slice(-2)+':'+('0'+n%60).slice(-2);}
  var s=staffText_(v);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:'';
}
function staffClockValue_(value) {
  var s=staffClock_(value);
  if (!s) throw new Error('Hora inválida');
  return (Number(s.slice(0,2))*60+Number(s.slice(3)))/1440;
}
function staffNow_(){return new Date();}
function staffNewId_(prefix){return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();}
function staffFind_(rows,index,id) {for(var i=0;i<rows.length;i++) if(staffText_(rows[i][index])===id) return i;return -1;}
function staffFree_(rows) {for(var i=0;i<rows.length;i++) if(!staffText_(rows[i][0])) return i;throw new Error('La hoja llegó a su límite de 1000 filas.');}
function staffAssertEmployee_(rows,id) {
  var index=staffFind_(rows,0,id);
  if(index<0) throw new Error('Empleado inexistente: '+id);
  if(staffText_(rows[index][10])!=='Activo') throw new Error('El empleado no está activo.');
  return rows[index];
}
function staffWithLock_(work) {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(18000)) throw new Error('Sistema ocupado; vuelve a intentarlo.');
  try {return work();} finally {lock.releaseLock();}
}
function staffInvalidate_() {
  // Version increments invalidate all per-person/date-window cache keys without listing them.
  var p=PropertiesService.getScriptProperties(), n=Number(p.getProperty('HMS_STAFF_VERSION')||0);
  p.setProperty('HMS_STAFF_VERSION',String(n+1));
}
function staffPut_(sh,rows,changed) {
  var ids=Object.keys(changed).map(Number).sort(function(a,b){return a-b;});
  if(!ids.length)return;
  // Each contiguous run is one write. Preserve existing formula cells within touched rows.
  for(var k=0;k<ids.length;) {
    var end=k;while(end+1<ids.length&&ids[end+1]===ids[end]+1)end++;
    var start=ids[k],count=ids[end]-start+1;
    var range=sh.getRange(HMS_STAFF.FIRST+start,1,count,rows[start].length);
    var formulas=range.getFormulas();
    var values=rows.slice(start,start+count).map(function(row,i){
      return row.map(function(value,j){return formulas[i][j]||value;});
    });
    range.setValues(values); k=end+1;
  }
}
function staffDateRange_(req) {
  var now=todayKey_(),start=staffValidDate_(req.startDate||now),end=staffValidDate_(req.endDate||now);
  if(end<start|| (Date.parse(end)-Date.parse(start))/86400000>93) throw new Error('Rango máximo de 94 días.');
  return {start:start,end:end};
}
function staffMapEmployee_(r) {
  var type=staffText_(r[6])||'Semanal',base=Number(r[7])||0;
  return {id:staffText_(r[0]),name:staffText_(r[1]),department:staffText_(r[2]),
    role:staffText_(r[3]),email:staffText_(r[4]),phone:staffText_(r[5]),
    payType:type,baseSalary:base,weeklySalary:type==='Semanal'?base:0,
    weeklyHours:Number(r[8])||0,hireDate:staffDate_(r[9]),status:staffText_(r[10])||'Activo',
    defaultShiftStart:'08:00',defaultShiftEnd:'16:00',defaultRestDay:0};
}
function staffMapShift_(r) {
  var kind=staffText_(r[6]);
  return {employeeId:staffText_(r[3]),date:staffDate_(r[2]),
    isRest:kind!=='Trabajo',unpaidLeave:kind==='Permiso sin goce',
    shiftStart:kind==='Trabajo'?staffClock_(r[7]):undefined,
    shiftEnd:kind==='Trabajo'?staffClock_(r[8]):undefined,
    shiftId:staffText_(r[0]),breakMinutes:Number(r[9])||0,state:staffText_(r[11])};
}
function staffMapRequest_(r) {
  var kind=staffText_(r[4]);
  return {id:staffText_(r[0]),employeeId:staffText_(r[2]),
    type:kind==='Cambio de día de descanso'?'Cambio de descanso':kind,
    requestedDate:staffDate_(r[5]),proposedDate:staffDate_(r[6])||undefined,
    reason:staffText_(r[7]),status:staffText_(r[8]),createdAt:r[1] instanceof Date?Utilities.formatDate(r[1],HMS_CONFIG.TIME_ZONE,'yyyy-MM-dd HH:mm'):staffText_(r[1]),
    reviewedBy:staffText_(r[9])};
}
function staffMapAttendance_(r){
  var elapsed=0;
  if(r[3] instanceof Date&&r[4] instanceof Date)
    elapsed=Math.max(0,(r[4].getTime()-r[3].getTime())/3600000-(Number(r[5])||0)/60);
  return {id:staffText_(r[0]),employeeId:staffText_(r[1]),date:staffDate_(r[2]),
    clockIn:staffClock_(r[3]),clockOut:staffClock_(r[4])||undefined,
    breakMinutes:Number(r[5])||0,hours:Number(r[6])||elapsed};
}
function getStaff_(req) {
  var principal=staffAuth_(req,false);
  var period=staffDateRange_(req),version=PropertiesService.getScriptProperties().getProperty('HMS_STAFF_VERSION')||'0';
  var key=HMS_STAFF.CACHE_PREFIX+version+':'+principal.id+':'+period.start+':'+period.end;
  // Cache key length must remain <250. Large payloads are not cached.
  var cache=CacheService.getScriptCache(),cached=!req.refresh&&cache.get(key);
  if(cached)return JSON.parse(cached);
  var ss=staffBook_(),people=staffRead_(staffSheet_(ss,'PERSONAL'),'PERSONAL');
  var shifts=staffRead_(staffSheet_(ss,'TURNOS_PERSONAL'),'TURNOS_PERSONAL');
  var requests=staffRead_(staffSheet_(ss,'SOLICITUDES_PERSONAL'),'SOLICITUDES_PERSONAL');
  var attendance=staffRead_(staffSheet_(ss,'ASISTENCIA_PERSONAL'),'ASISTENCIA_PERSONAL');
  var own=function(id){return principal.admin||id===principal.employeeId;};
  var payload={
    staff:people.filter(function(r){return r[0]&&own(staffText_(r[0]));}).map(staffMapEmployee_),
    staffSchedules:shifts.filter(function(r){var date=staffDate_(r[2]);return r[0]&&own(staffText_(r[3]))&&date>=period.start&&date<=period.end&&staffText_(r[11])!=='Cancelado';}).map(staffMapShift_),
    staffRequests:requests.filter(function(r){var date=staffDate_(r[5]);return r[0]&&own(staffText_(r[2]))&&(staffText_(r[8])==='Pendiente'||(date>=period.start&&date<=period.end));}).map(staffMapRequest_),
    staffTimeEntries:attendance.filter(function(r){var date=staffDate_(r[2]);return r[0]&&own(staffText_(r[1]))&&date>=period.start&&date<=period.end;}).map(staffMapAttendance_),
    userAccounts:[],generatedAt:new Date().toISOString()
  };
  var json=JSON.stringify(payload);
  if(json.length<90000&&key.length<250)cache.put(key,json,HMS_STAFF.CACHE_SECONDS);
  return payload;
}
function saveStaffEmployee_(req) {
  staffAuth_(req,true);
  var input=req.employee||{},name=staffUserText_(input.name,120),role=staffText_(input.role);
  if(!name||name.length>120||!HMS_STAFF.ROLE_DEPT[role])throw new Error('Nombre o puesto inválido.');
  var type=staffText_(input.payType)||'Semanal';
  if(['Por hora','Por día','Semanal','Quincenal','Mensual'].indexOf(type)<0)throw new Error('Tipo de pago no válido.');
  var amount=Number(input.baseSalary===undefined?input.weeklySalary:input.baseSalary);
  if(!isFinite(amount)||amount<=0||amount>1000000)throw new Error('Sueldo base no válido.');
  return staffWithLock_(function(){
    var sh=staffSheet_(staffBook_(),'PERSONAL'),rows=staffRead_(sh,'PERSONAL');
    var id=staffText_(input.id),index=id?staffFind_(rows,0,id):-1;
    if(id&&index<0)throw new Error('No existe el empleado a editar.');
    if(!id) {id=staffNewId_('EMP');index=staffFree_(rows);}
    var previous=rows[index].slice(),updated=previous.slice(),now=staffNow_();
    updated[0]=id;updated[1]=name;updated[2]=HMS_STAFF.ROLE_DEPT[role];updated[3]=role;
    if(input.email!==undefined)updated[4]=staffUserText_(input.email,180);
    if(input.phone!==undefined)updated[5]=staffUserText_(input.phone,40);
    updated[6]=type;updated[7]=amount;
    if(input.weeklyHours!==undefined)updated[8]=Math.max(0,Number(input.weeklyHours)||0);
    if(!updated[9])updated[9]=now;
    updated[10]=input.status==='Inactivo'?'Inactivo':(staffText_(previous[10])||'Activo');
    updated[12]=now;
    sh.getRange(HMS_STAFF.FIRST+index,1,1,13).setValues([updated]);
    staffInvalidate_();return {employee:staffMapEmployee_(updated)};
  });
}
function setStaffStatus_(req) {
  staffAuth_(req,true);
  var id=staffText_(req.employeeId),status=staffText_(req.status);
  if(['Activo','Inactivo'].indexOf(status)<0)throw new Error('Estado no válido.');
  return staffWithLock_(function(){
    var sh=staffSheet_(staffBook_(),'PERSONAL'),rows=staffRead_(sh,'PERSONAL'),i=staffFind_(rows,0,id);
    if(i<0)throw new Error('Empleado no encontrado.');
    sh.getRange(HMS_STAFF.FIRST+i,11).setValue(status);
    sh.getRange(HMS_STAFF.FIRST+i,13).setValue(staffNow_());
    staffInvalidate_();return {employeeId:id,status:status};
  });
}
function saveStaffSchedules_(req) {
  staffAuth_(req,true);
  var items=req.entries;
  if(!Array.isArray(items)||!items.length||items.length>700)throw new Error('Se permiten de 1 a 700 turnos por operación.');
  return staffWithLock_(function(){
    var ss=staffBook_(),employees=staffRead_(staffSheet_(ss,'PERSONAL'),'PERSONAL');
    var sh=staffSheet_(ss,'TURNOS_PERSONAL'),rows=staffRead_(sh,'TURNOS_PERSONAL');
    var indexByKey={},changed={},newCount=0,usedKeys={};
    rows.forEach(function(r,i){if(r[0]){var key=staffText_(r[3])+'|'+staffDate_(r[2]);if(indexByKey[key]!==undefined)throw new Error('Duplicado en TURNOS_PERSONAL: '+key);indexByKey[key]=i;}});
    items.forEach(function(item){
      var id=staffText_(item.employeeId),date=staffValidDate_(item.date),key=id+'|'+date;
      if(usedKeys[key])throw new Error('Turno repetido en la solicitud: '+key);
      usedKeys[key]=true;staffAssertEmployee_(employees,id);
      var old=indexByKey[key],i=old!==undefined?old:staffFree_(rows);
      var prior=rows[i].slice();
      if(prior[0]&&staffText_(prior[6])==='Permiso sin goce'&&item.unpaidLeave!==true)
        throw new Error('No puede sobrescribirse un permiso aprobado: '+key);
      var rest=!!item.isRest,leave=!!item.unpaidLeave;
      var start=rest?'':staffClock_(item.shiftStart),end=rest?'':staffClock_(item.shiftEnd);
      if(!rest&&(!start||!end||end<=start))throw new Error('Horario inválido: '+key);
      var current=prior.slice();
      current[0]=prior[0]||staffNewId_('TUR');current[2]=staffDateValue_(date);current[3]=id;
      current[6]=leave?'Permiso sin goce':rest?'Descanso':'Trabajo';
      current[7]=rest?'':staffClockValue_(start);
      current[8]=rest?'':staffClockValue_(end);
      current[9]=Math.max(0,Number(item.breakMinutes)||0);
      current[11]=prior[0]?'Modificado':'Publicado';current[12]=staffText_(item.requestId)||prior[12]||'';
      current[13]=item.note===undefined?(prior[13]||''):staffUserText_(item.note,300);current[14]=staffNow_();
      rows[i]=current;changed[i]=true;indexByKey[key]=i;
      if(!prior[0])newCount++;
    });
    staffPut_(sh,rows,changed);staffInvalidate_();return {saved:items.length,created:newCount};
  });
}
function deleteStaffSchedule_(req) {
  staffAuth_(req,true);
  var id=staffText_(req.employeeId),date=staffValidDate_(req.date);
  return staffWithLock_(function(){
    var sh=staffSheet_(staffBook_(),'TURNOS_PERSONAL'),rows=staffRead_(sh,'TURNOS_PERSONAL');
    var i=rows.findIndex(function(row){return row[0]&&staffText_(row[3])===id&&staffDate_(row[2])===date;});
    if(i<0)return {deleted:false};
    if(staffText_(rows[i][6])==='Permiso sin goce')throw new Error('No se puede quitar un permiso aprobado.');
    sh.getRange(HMS_STAFF.FIRST+i,12).setValue('Cancelado');
    sh.getRange(HMS_STAFF.FIRST+i,15).setValue(staffNow_());
    staffInvalidate_();return {deleted:true};
  });
}
function createStaffRequest_(req) {
  var input=req.request||{},id=staffText_(input.employeeId),principal=staffAuth_(req,false,id);
  var kind=staffText_(input.type),date=staffValidDate_(input.requestedDate);
  if(['Cambio de descanso','Día libre sin goce'].indexOf(kind)<0)throw new Error('Tipo de solicitud inválido.');
  var proposed=kind==='Cambio de descanso'?staffValidDate_(input.proposedDate):'';
  if(proposed&&proposed===date)throw new Error('El descanso debe cambiar a otra fecha.');
  var reason=staffUserText_(input.reason,500);
  if(!reason||reason.length>500)throw new Error('Motivo inválido.');
  return staffWithLock_(function(){
    var ss=staffBook_();staffAssertEmployee_(staffRead_(staffSheet_(ss,'PERSONAL'),'PERSONAL'),id);
    var sh=staffSheet_(ss,'SOLICITUDES_PERSONAL'),rows=staffRead_(sh,'SOLICITUDES_PERSONAL');
    var i=staffFree_(rows),requestId=staffText_(input.id)||staffNewId_('SOL');
    if(!/^[a-zA-Z0-9_-]{4,80}$/.test(requestId))throw new Error('ID de solicitud inválido.');
    if(staffFind_(rows,0,requestId)>=0)throw new Error('La solicitud ya existe.');
    var newRow=rows[i].slice(),now=staffNow_();
    newRow[0]=requestId;newRow[1]=now;newRow[2]=id;
    newRow[4]=kind==='Cambio de descanso'?'Cambio de día de descanso':kind;
    newRow[5]=staffDateValue_(date);newRow[6]=proposed?staffDateValue_(proposed):'';
    newRow[7]=reason;newRow[8]='Pendiente';newRow[12]=now;
    rows[i]=newRow;var changed={};changed[i]=true;
    staffPut_(sh,rows,changed);staffInvalidate_();
    return {request:staffMapRequest_(newRow)};
  });
}
function reviewStaffRequest_(req) {
  var principal=staffAuth_(req,true),id=staffText_(req.requestId),decision=staffText_(req.status);
  if(['Aprobada','Rechazada'].indexOf(decision)<0)throw new Error('Decisión inválida.');
  return staffWithLock_(function(){
    var ss=staffBook_(),sh=staffSheet_(ss,'SOLICITUDES_PERSONAL'),rows=staffRead_(sh,'SOLICITUDES_PERSONAL');
    var i=staffFind_(rows,0,id);
    if(i<0)throw new Error('Solicitud inexistente.');
    if(staffText_(rows[i][8])===decision)return {request:staffMapRequest_(rows[i]),alreadyReviewed:true};
    if(staffText_(rows[i][8])!=='Pendiente')throw new Error('Solicitud previamente resuelta.');
    var request=staffMapRequest_(rows[i]);
    if(decision==='Aprobada') {
      var people=staffRead_(staffSheet_(ss,'PERSONAL'),'PERSONAL');staffAssertEmployee_(people,request.employeeId);
      var shiftsSheet=staffSheet_(ss,'TURNOS_PERSONAL'),shifts=staffRead_(shiftsSheet,'TURNOS_PERSONAL');
      var change=[],find=function(date) {return shifts.findIndex(function(r){return r[0]&&staffText_(r[3])===request.employeeId&&staffDate_(r[2])===date;});};
      var a=find(request.requestedDate),b=request.proposedDate?find(request.proposedDate):-1;
      if(request.type==='Cambio de descanso') {
        if(a<0||b<0||staffText_(shifts[a][6])!=='Descanso'||staffText_(shifts[b][6])!=='Trabajo')
          throw new Error('Los turnos cambiaron; revisa antes de aprobar.');
        var oldWork=shifts[b].slice();
        shifts[a][6]='Trabajo';shifts[a][7]=oldWork[7];shifts[a][8]=oldWork[8];shifts[a][9]=oldWork[9];shifts[a][11]='Modificado';shifts[a][12]=id;shifts[a][14]=staffNow_();
        shifts[b][6]='Descanso';shifts[b][7]='';shifts[b][8]='';shifts[b][9]=0;shifts[b][11]='Modificado';shifts[b][12]=id;shifts[b][14]=staffNow_();
        change=[a,b];
      } else {
        if(a<0)throw new Error('El turno afectado no existe; ajústalo antes de aprobar.');
        if(staffText_(shifts[a][6])==='Permiso sin goce')throw new Error('Permiso ya registrado.');
        shifts[a][6]='Permiso sin goce';shifts[a][7]='';shifts[a][8]='';shifts[a][9]=0;
        shifts[a][11]='Modificado';shifts[a][12]=id;shifts[a][14]=staffNow_();change=[a];
      }
      var changed={};change.forEach(function(n){changed[n]=true;});staffPut_(shiftsSheet,shifts,changed);
    }
    var now=staffNow_(),updated=rows[i].slice();
    updated[8]=decision;updated[9]=principal.id;updated[10]=now;updated[11]=staffUserText_(req.note,300);
    updated[12]=now;rows[i]=updated;var touched={};touched[i]=true;staffPut_(sh,rows,touched);
    staffInvalidate_();return {request:staffMapRequest_(updated)};
  });
}
function punchStaff_(req) {
  var id=staffText_(req.employeeId),principal=staffAuth_(req,false,id);
  if(!id||principal.employeeId!==id)throw new Error('El fichaje requiere identidad individual verificada.');
  var action=staffText_(req.kind),today=todayKey_();
  if(['in','out'].indexOf(action)<0)throw new Error('Acción inválida.');
  return staffWithLock_(function(){
    var ss=staffBook_(),sh=staffSheet_(ss,'ASISTENCIA_PERSONAL'),rows=staffRead_(sh,'ASISTENCIA_PERSONAL');
    staffAssertEmployee_(staffRead_(staffSheet_(ss,'PERSONAL'),'PERSONAL'),id);
    var schedule=staffRead_(staffSheet_(ss,'TURNOS_PERSONAL'),'TURNOS_PERSONAL');
    if(!schedule.some(function(r){return r[0]&&staffText_(r[3])===id&&staffDate_(r[2])===today&&staffText_(r[6])==='Trabajo'&&staffText_(r[11])!=='Cancelado';}))
      throw new Error('No hay turno publicado para hoy.');
    var idx=rows.findIndex(function(r){return r[0]&&staffText_(r[1])===id&&staffDate_(r[2])===today;});
    if(action==='in'&&idx>=0)throw new Error('Entrada ya registrada.');
    if(action==='out'&&(idx<0||!rows[idx][3]||rows[idx][4]))throw new Error('No existe entrada abierta.');
    var now=staffNow_(),i=idx<0?staffFree_(rows):idx;
    var r=rows[i].slice();
    if(action==='in'){r[0]=staffNewId_('ASI');r[1]=id;r[2]=staffDateValue_(today);r[3]=now;r[7]='Entrada registrada';r[8]='Web';}
    else{r[4]=now;r[6]=Math.max(0,Math.round(((now.getTime()-r[3].getTime())/3600000-(Number(r[5])||0)/60)*100)/100);r[7]='Turno finalizado';}
    r[10]=principal.id;r[11]=now;rows[i]=r;
    var touched={};touched[i]=true;staffPut_(sh,rows,touched);staffInvalidate_();
    return {entry:staffMapAttendance_(r)};
  });
}

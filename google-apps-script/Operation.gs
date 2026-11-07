/**
 * Operación diaria. Lectura de hojas existentes y eventos de limpieza.
 * ESTADO_HABITACIONES B:F son fórmulas: no escribir allí.
 * REGISTRO_LIMPIEZA fila 5 es encabezado; desde fila 6 se agregan eventos.
 */
function getOperation_(refresh) {
  var cache = CacheService.getScriptCache();
  var cached = !refresh && cache.get(HMS_CONFIG.OPERATION_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  var ss = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var roomsSheet = requireOperationSheet_(ss, HMS_CONFIG.SHEETS.ROOM_STATES, 5,
    ['Habitación','Ocupación','Salida','Entrada','Trabajo requerido','Estado','Responsable',
     'Inicio','Terminación','Incidencia activa','Detalle','Área responsable','Actualizado']);
  var logSheet = requireOperationSheet_(ss, HMS_CONFIG.SHEETS.CLEANING_LOG, 5,
    ['Fecha y hora','Habitación','Acción','Personal','Trabajo','Nota']);
  var catalogSheet = ss.getSheetByName(HMS_CONFIG.SHEETS.ROOM_CATALOG);
  if (!catalogSheet) throw new Error('Falta CONFIGURACION.');
  var catalog = {};
  catalogSheet.getRange(19, 1, Math.max(1, catalogSheet.getLastRow()-18), 5).getValues()
    .forEach(function(row) {
      if (/^(sí|si|true|1)$/i.test(String(row[4] || '').trim())) {
        catalog[String(row[0]).trim()] = String(row[1]).trim();
      }
    });
  var roomRows = roomsSheet.getRange(6, 1, Math.max(1, roomsSheet.getLastRow()-5), 13).getValues();
  var rooms = roomRows.filter(function(row) { return catalog[String(row[0]).trim()]; }).map(function(row) {
    var occupancy = String(row[1] || '').trim();
    var required = String(row[4] || '');
    var status = String(row[5] || '').trim();
    var issueActive = /^s[ií]$/i.test(String(row[9] || '').trim());
    return {
      roomNumber: String(row[0]).trim(),
      roomType: catalog[String(row[0]).trim()],
      occupancy: occupancy === 'Ocupada' ? 'Ocupada' : 'Libre',
      cleaning: /terminad|lista|limpia|completad/i.test(status) ? 'Limpia'
        : /proceso/i.test(status) ? 'En limpieza'
        : /revisar|check/i.test(status) ? 'Por revisar'
        : required === 'Ninguno' ? 'Limpia' : 'Sucia',
      issues: issueActive ? [{
        id: 'ESTADO-' + String(row[0]).trim(), type: 'Otro faltante o falla',
        status: 'Pendiente', reportedAt: '', reportedBy: String(row[11] || ''),
      }] : [],
      blockReason: '',
      accessStatus: 'Normal',
      activityLog: []
    };
  });
  var logCount = Math.max(0, logSheet.getLastRow() - 5);
  var logs = logCount ? logSheet.getRange(Math.max(6, logSheet.getLastRow()-499), 1,
    Math.min(logCount, 500), 6).getValues() : [];
  var today = todayKey_();
  var operationTasks = [];
  var history = [];
  logs.forEach(function(row, index) {
    if (!(row[0] instanceof Date)) return;
    var timestamp = Utilities.formatDate(row[0], HMS_CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");
    var room = String(row[1] || '').trim();
    var action = String(row[2] || '').trim();
    var worker = String(row[3] || '').trim();
    var work = String(row[4] || '').trim();
    var note = String(row[5] || '');
    var logId = 'LIM-' + timestamp + '-' + room + '-' + index;
    history.push({ id: logId, date: timestamp.slice(0,10), roomNumber: room,
      action: action, worker: worker, work: work, note: note, timestamp: timestamp });
    var target = rooms.find(function(r) { return r.roomNumber === room; });
    if (!target) return;
    target.activityLog.push({ id: logId, action: action, by: worker, at: timestamp });
    // Conservar estado desde acciones reales. El registro es fuente de eventos.
    if (/limpieza solicitada|marcar sucia|solicitar limpieza/i.test(action)) target.cleaning = 'Sucia';
    if (/inici[oó] limpieza|inici[oó] trabajo/i.test(action)) target.cleaning = 'En limpieza';
    if (/termin[oó] limpieza|limpieza terminada/i.test(action)) target.cleaning = 'Por revisar';
    if (/check confirmado|habitaci[oó]n aprobada/i.test(action)) target.cleaning = 'Limpia';
    if (/incidencia reportada/i.test(action)) {
      target.issues.push({ id: logId, type: 'Otro faltante o falla', status: 'Pendiente',
        reportedAt: timestamp, reportedBy: worker });
    }
    if (/incidencia resuelta/i.test(action)) target.issues = [];
    // Tareas activas: un evento genera, inicia o cierra una tarea por habitación.
    var isOpen = /limpieza solicitada|marcar sucia|inici[oó] limpieza|inici[oó] trabajo/i.test(action);
    var isClosed = /termin[oó] limpieza|limpieza terminada|check confirmado|habitaci[oó]n aprobada/i.test(action);
    if (isOpen || isClosed) {
      var existing = operationTasks.find(function(t) { return t.roomNumber === room && t.status !== 'Terminada'; });
      if (isOpen && !existing) {
        operationTasks.push({
          id: logId, date: timestamp.slice(0,10), roomNumber: room, roomType: target.roomType,
          type: /salida/i.test(work) ? 'Limpieza de salida' : 'Limpieza general',
          status: /inici[oó]/i.test(action) ? 'En proceso' : 'Pendiente',
          priority: 'Normal', assignedTo: worker, requestedAt: timestamp,
          note: note, deadline: 'Hoy'
        });
      } else if (isOpen && existing) existing.status = /inici[oó]/i.test(action) ? 'En proceso' : existing.status;
      if (isClosed && existing) { existing.status = 'Terminada'; existing.completedAt = timestamp; }
    }
  });
  var dayRows = ss.getSheetByName(HMS_CONFIG.SHEETS.DAILY_OPERATION);
  if (!dayRows) throw new Error('Falta OPERACION_DIARIA.');
  var daily = dayRows.getRange(7, 1, Math.max(1, dayRows.getLastRow()-6), 18).getValues();
  var operationDays = daily.filter(function(row){return row[0] instanceof Date;}).map(function(row){
    return {date:dateKey_(row[0]),status:'No iniciado'};
  });
  var payload = {roomStates: rooms, operationTasks: operationTasks,
    operationDays: operationDays, cleaningHistory: history,
    generatedAt:new Date().toISOString()};
  cache.put(HMS_CONFIG.OPERATION_CACHE_KEY, JSON.stringify(payload), HMS_CONFIG.OPERATION_CACHE_SECONDS);
  return payload;
}

/** Action allowlist. No writing to formula columns B:F. */
function recordOperationEvent_(request) {
  var room = String(request.roomNumber || '').trim();
  var action = String(request.actionType || '').trim();
  var person = String(request.worker || 'Sistema HMS').slice(0, 100);
  var note = String(request.note || '').slice(0, 500);
  var work = String(request.work || '').slice(0, 120);
  var eventId = String(request.eventId || '').trim();
  var allowed = [
    'Limpieza solicitada','Marcar sucia','Inició limpieza','Terminó limpieza',
    'Check confirmado','Habitación aprobada','Incidencia reportada','Incidencia resuelta'
  ];
  if (!room || !eventId || allowed.indexOf(action) < 0) throw new Error('Evento inválido.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var states = ss.getSheetByName(HMS_CONFIG.SHEETS.ROOM_STATES);
    var log = requireOperationSheet_(ss, HMS_CONFIG.SHEETS.CLEANING_LOG, 5,
      ['Fecha y hora','Habitación','Acción','Personal','Trabajo','Nota']);
    var stateRows = states.getRange(6, 1, Math.max(1, states.getLastRow()-5), 13).getValues();
    var match = stateRows.findIndex(function(row) {return String(row[0]).trim()===room;});
    if (match < 0) throw new Error('Habitación no encontrada.');
    var last = log.getLastRow();
    if (last >= 6) {
      var old = log.getRange(6, 6, last-5, 1).createTextFinder('ID:' + eventId)
        .matchCase(true).findNext();
      if (old) return {eventId:eventId, recorded:true, duplicate:true};
    }
    var now = new Date();
    log.getRange(Math.max(6, last+1),1,1,6).setValues([
      [now,room,action,person,work,(note ? note + ' | ' : '') + 'ID:' + eventId]
    ]);
    // G:M son campos operativos/manuales; evitar sobrescribir B:F (fórmulas).
    var rowNo = match + 6;
    states.getRange(rowNo, 7).setValue(person);
    if (action === 'Inició limpieza') states.getRange(rowNo, 8).setValue(now);
    if (action === 'Terminó limpieza') states.getRange(rowNo, 9).setValue(now);
    if (action === 'Incidencia reportada') {
      states.getRange(rowNo, 10).setValue('Sí');
      states.getRange(rowNo, 11).setValue(note || work);
      states.getRange(rowNo, 12).setValue(person);
    }
    if (action === 'Incidencia resuelta') states.getRange(rowNo, 10).setValue('No');
    states.getRange(rowNo, 13).setValue(now);
    clearOperationCache_();
    return {eventId:eventId,recorded:true,duplicate:false};
  } finally {lock.releaseLock();}
}

function requireOperationSheet_(ss, name, headerRow, expected) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Falta ' + name);
  var headers = sheet.getRange(headerRow,1,1,expected.length).getDisplayValues()[0];
  expected.forEach(function(header,index){
    if (String(headers[index]||'').trim() !== header)
      throw new Error(name + ': columna ' + (index+1) + ' distinta de ' + header);
  });
  return sheet;
}

function clearOperationCache_() {
  CacheService.getScriptCache().remove(HMS_CONFIG.OPERATION_CACHE_KEY);
}

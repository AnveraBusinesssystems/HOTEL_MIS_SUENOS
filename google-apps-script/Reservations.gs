function getReservations_(refresh) {
  var cache = CacheService.getScriptCache();
  var cached = !refresh && cache.get(HMS_CONFIG.RESERVATIONS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var spreadsheet = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.RESERVATIONS);
  if (!sheet) throw new Error('Falta la hoja ' + HMS_CONFIG.SHEETS.RESERVATIONS + '.');

  assertReservationHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var payload = { reservations: [], generatedAt: new Date().toISOString() };
  if (lastRow < 2) return payload;

  var today = new Date(todayKey_() + 'T12:00:00');
  var windowStart = new Date(today);
  var windowEnd = new Date(today);
  windowStart.setDate(windowStart.getDate() - 30);
  windowEnd.setDate(windowEnd.getDate() + 180);
  var startKey = dateKey_(windowStart);
  var endKey = dateKey_(windowEnd);

  var operationalToday = todayKey_();
  payload.reservations = sheet.getRange(2, 1, lastRow - 1, 35).getValues()
    .map(function (row) { return mapReservationRow_(row, operationalToday); })
    .filter(function (reservation) {
      return reservation && reservation.checkOut >= startKey && reservation.checkIn <= endKey;
    })
    .sort(function (a, b) {
      return a.checkIn.localeCompare(b.checkIn) || a.id.localeCompare(b.id);
    })
    .slice(0, 500);

  cache.put(HMS_CONFIG.RESERVATIONS_CACHE_KEY, JSON.stringify(payload), HMS_CONFIG.RESERVATIONS_CACHE_SECONDS);
  return payload;
}

function mapReservationRow_(row, operationalToday) {
  if (!row[0] || !(row[6] instanceof Date) || !(row[7] instanceof Date)) return null;

  var checkIn = dateKey_(row[6]);
  var checkOut = dateKey_(row[7]);
  var status = reservationStatus_(row[26], row[16], checkOut, operationalToday || todayKey_());
  var roomType = normalizedRoomType_(String(row[29] || '').split('|')[0].trim()) || normalizedRoomType_(row[28]);
  if (!roomType) return null;

  var total = numberOrZero_(row[20]);
  var paid = numberOrZero_(row[21]);
  var channel = reservationChannel_(row[27], row[15]);

  return {
    id: String(row[2] || row[0]),
    subReservationId: String(row[0]),
    guestName: String(row[4] || 'Huésped sin nombre'),
    email: '',
    phone: '',
    checkIn: checkIn,
    checkOut: checkOut,
    adults: numberOrZero_(row[13]),
    children: numberOrZero_(row[14]),
    roomType: roomType,
    roomNumber: String(row[31] || row[30] || '').trim() || undefined,
    status: status,
    channel: channel,
    total: total,
    paid: paid,
    paymentKnown: row[21] !== '' && row[21] !== null,
    multiRoom: numberOrZero_(row[9]) > 1 || String(row[33]).trim().toLowerCase() === 'sí',
    createdAt: dateKey_(row[5]),
    notes: String(row[34] === 'OK' ? '' : row[34] || ''),
    cleaningRequested: false,
    nights: []
  };
}

function reservationStatus_(normalized, source, checkOut, operationalToday) {
  var value = String(normalized || source || '').toLowerCase();
  if (value.indexOf('cancel') >= 0) return 'Cancelada';
  if (value.indexOf('no show') >= 0 || value.indexOf('no_show') >= 0 || value.indexOf('no-show') >= 0) return 'No show';
  if (value.indexOf('hosped') >= 0 || value.indexOf('in_house') >= 0) return 'Hospedado';
  if (value.indexOf('salida') >= 0 || value.indexOf('checked_out') >= 0) return 'Salida';
  if (checkOut < operationalToday) return 'Salida';
  return 'Confirmada';
}

function reservationChannel_(normalized, source) {
  var value = String(normalized || source || '').toLowerCase();
  if (value.indexOf('booking') >= 0) return 'Booking.com';
  if (value.indexOf('expedia') >= 0) return 'Expedia';
  if (value.indexOf('cloudbeds') >= 0) return 'Cloudbeds';
  if (value.indexOf('direct') >= 0) return 'Directa';
  return 'Walk-in';
}

function normalizedRoomType_(value) {
  var match = String(value || '').toUpperCase().match(/\b(?:NAY|CHA|KAA|MUU|NA)\b/);
  return match ? match[0] : '';
}

function clearReservationsCache() {
  CacheService.getScriptCache().remove(HMS_CONFIG.RESERVATIONS_CACHE_KEY);
}

/**
 * Reserva fuente: A:AI. AA:AI SON ARRAYFORMULA; no escribir allí.
 * Se pueden editar: Q estado, M habitación asignada, V importe pagado
 * (solo cuando el monto de pagos previo es conocido), Z actualización.
 */
function updateReservation_(request) {
  var key = String(request.reservationKey || '').trim();
  var changes = request.changes || {};
  if (!key) throw new Error('Falta la clave de reserva.');
  var fields = Object.keys(changes);
  if (!fields.length || fields.some(function(field) {
    return ['status', 'roomNumber'].indexOf(field) === -1;
  })) throw new Error('Solo se permite cambiar estado y asignación desde esta acción.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(HMS_CONFIG.SHEETS.RESERVATIONS);
    assertReservationHeaders_(sheet);
    var rowNo = reservationRowForKey_(sheet, key);
    var row = sheet.getRange(rowNo, 1, 1, 35).getValues()[0];
    if (Object.prototype.hasOwnProperty.call(changes, 'roomNumber')) {
      if (numberOrZero_(row[9]) !== 1 || String(row[33]).toLowerCase() === 'sí') {
        throw new Error('Reservas multihabitación requieren asignación por separado.');
      }
      var desired = String(changes.roomNumber || '').trim();
      if (desired) {
        var code = normalizedRoomType_(row[29]) || normalizedRoomType_(row[28]);
        var room = validateRoomAssignment_(ss, sheet, rowNo, desired, code, row[6], row[7]);
        // M almacena el formato original sin guion; AE:AG normalizan por fórmula.
        sheet.getRange(rowNo, 13).setValue(room.replace(/-/g, ''));
      } else {
        sheet.getRange(rowNo, 13).clearContent();
      }
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
      var states = {
        'Confirmada':'confirmed', 'Hospedado':'in_house', 'Salida':'checked_out',
        'Cancelada':'cancelled', 'No show':'no_show'
      };
      var status = states[changes.status];
      if (!status) throw new Error('Estado no permitido.');
      sheet.getRange(rowNo, 17).setValue(status);
      // AA se actualiza sola desde Q; nunca sobrescribir ARRAYFORMULA.
    }
    sheet.getRange(rowNo, 26).setValue(new Date());
    SpreadsheetApp.flush();
    invalidateReservationDependents_();
    return mapReservationRow_(sheet.getRange(rowNo, 1, 1, 35).getValues()[0], todayKey_());
  } finally { lock.releaseLock(); }
}

function reservationRowForKey_(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('No hay reservas.');
  var match = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(key).matchEntireCell(true).findNext();
  if (!match) throw new Error('Reserva no encontrada.');
  return match.getRow();
}

function assertReservationHeaders_(sheet) {
  if (!sheet) throw new Error('Falta la hoja RESERVAS.');
  var headers = sheet.getRange(1, 1, 1, 35).getDisplayValues()[0];
  var required = {
    1:'Clave de reserva', 7:'Entrada', 8:'Salida', 10:'Habitaciones reservadas',
    13:'Habitaciones asignadas', 17:'Estado', 21:'Total de reserva',
    22:'Monto pagado', 23:'Saldo', 26:'Última actualización',
    27:'Estado normalizado', 30:'Códigos de categoría',
    34:'Reserva multihabitación'
  };
  Object.keys(required).forEach(function(column) {
    if (String(headers[Number(column)-1] || '').trim() !== required[column])
      throw new Error('Estructura incompatible en RESERVAS, columna ' + column);
  });
}

function validateRoomAssignment_(ss, sheet, ownRow, room, code, checkIn, checkOut) {
  var config = ss.getSheetByName(HMS_CONFIG.SHEETS.ROOM_CATALOG);
  if (!config) throw new Error('Falta CONFIGURACION.');
  var names = config.getRange(19, 1, Math.max(1, config.getLastRow()-18), 5).getValues();
  var match = names.some(function(r) {
    return String(r[0]).trim() === room && String(r[1]).trim() === code &&
      /^(sí|si|true|1)$/i.test(String(r[4]).trim());
  });
  if (!match) throw new Error('Habitación no activa o de categoría distinta.');
  var otherRows = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow()-1), 17).getValues();
  for (var i = 0; i < otherRows.length; i++) {
    if (i+2 === ownRow) continue;
    var r = otherRows[i];
    if (!(r[6] instanceof Date) || !(r[7] instanceof Date)) continue;
    if (String(r[16]).toLowerCase().match(/cancel|no.show/)) continue;
    if (!(checkIn < r[7] && checkOut > r[6])) continue;
    var assigned = String(r[12] || '').toUpperCase().replace(/\s/g,'')
      .replace(/([A-Z]+)(\d+)/g,'$1-$2').split(',');
    if (assigned.indexOf(room.toUpperCase()) !== -1) {
      throw new Error('Habitación ocupada por otra reserva en esas fechas.');
    }
  }
  return room;
}

function invalidateReservationDependents_() {
  var cache = CacheService.getScriptCache();
  cache.remove(HMS_CONFIG.RESERVATIONS_CACHE_KEY);
  cache.remove(HMS_CONFIG.RMS_CACHE_KEY);
  cache.remove(HMS_CONFIG.SUMMARY_CACHE_KEY);
  cache.remove(HMS_CONFIG.INDICATORS_CACHE_KEY);
}

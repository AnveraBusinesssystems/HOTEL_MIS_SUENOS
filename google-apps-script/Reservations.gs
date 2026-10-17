function getReservations_(refresh) {
  var cache = CacheService.getScriptCache();
  var cached = !refresh && cache.get(HMS_CONFIG.RESERVATIONS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var spreadsheet = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.RESERVATIONS);
  if (!sheet) throw new Error('Falta la hoja ' + HMS_CONFIG.SHEETS.RESERVATIONS + '.');

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
  var roomType = String(row[29] || '').split('|')[0].trim();
  if (!roomType) roomType = normalizedRoomType_(row[28]);
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
    createdAt: dateKey_(row[5]),
    notes: String(row[34] === 'OK' ? '' : row[34] || ''),
    cleaningRequested: false,
    nights: []
  };
}

function reservationStatus_(normalized, source, checkOut, operationalToday) {
  var value = String(normalized || source || '').toLowerCase();
  if (value.indexOf('cancel') >= 0) return 'Cancelada';
  if (value.indexOf('no show') >= 0 || value.indexOf('no_show') >= 0) return 'No show';
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
  var match = String(value || '').match(/(?:NAY|NA|CHA|KAA|MUU)/);
  return match ? match[0] : '';
}

function clearReservationsCache() {
  CacheService.getScriptCache().remove(HMS_CONFIG.RESERVATIONS_CACHE_KEY);
}

function updateReservation_(request) {
  var key = String(request.reservationKey || '').trim();
  var changes = request.changes || {};
  if (!key) throw new Error('Falta la clave de reserva.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var spreadsheet = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.RESERVATIONS);
    var match = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1)
      .createTextFinder(key).matchEntireCell(true).findNext();
    if (!match) throw new Error('Reserva no encontrada.');

    var rowNumber = match.getRow();
    var row = sheet.getRange(rowNumber, 1, 1, 35).getValues()[0];
    if (changes.status) {
      var sourceStatus = {
        'Confirmada': 'confirmed', 'Hospedado': 'in_house', 'Salida': 'checked_out',
        'Cancelada': 'cancelled', 'No show': 'no_show'
      }[changes.status];
      if (!sourceStatus) throw new Error('Estado no permitido.');
      sheet.getRange(rowNumber, 17).setValue(sourceStatus);
      sheet.getRange(rowNumber, 27).setValue(changes.status);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'roomNumber')) {
      if (String(row[33]).toLowerCase() === 'sí') throw new Error('La asignación multihabitación requiere revisión manual.');
      var room = String(changes.roomNumber || '').trim();
      sheet.getRange(rowNumber, 13).setValue(room.replace('-', ''));
      sheet.getRange(rowNumber, 31, 1, 3).setValues([[room, room, room ? 1 : 0]]);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'paid')) {
      var paid = numberOrZero_(changes.paid);
      var total = numberOrZero_(row[20]);
      if (paid < 0 || paid > total) throw new Error('El monto pagado no es válido.');
      sheet.getRange(rowNumber, 22, 1, 2).setValues([[paid, Math.max(0, total - paid)]]);
    }
    sheet.getRange(rowNumber, 26).setValue(new Date());
    clearReservationsCache();
    return mapReservationRow_(sheet.getRange(rowNumber, 1, 1, 35).getValues()[0]);
  } finally {
    lock.releaseLock();
  }
}

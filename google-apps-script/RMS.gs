/**
 * RMS operativo: calendario futuro calculado a partir de RESERVAS.
 * No inventa tarifas ni predicciones. La tarifa actual, recomendada y pickup
 * quedan null hasta integrar fuentes con información verificable.
 */
function getRms_(refresh) {
  var cache = CacheService.getScriptCache();
  var key = HMS_CONFIG.RMS_CACHE_KEY;
  var saved = !refresh && cache.get(key);
  if (saved) return JSON.parse(saved);

  var ss = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var rooms = readRmsRoomCatalog_(ss);
  var today = todayKey_();
  var start = new Date(today + 'T12:00:00');
  var days = 180;
  var dateKeys = [];
  var occupancy = {};
  var byCategory = {};
  rooms.forEach(function(room) {
    byCategory[room.code] = room;
  });
  for (var d = 0; d < days; d++) {
    var dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    var date = dateKey_(dt);
    dateKeys.push(date);
    occupancy[date] = {};
  }

  var sheet = ss.getSheetByName(HMS_CONFIG.SHEETS.RESERVATIONS);
  if (!sheet) throw new Error('Falta RESERVAS.');
  var head = sheet.getRange(1, 1, 1, 30).getDisplayValues()[0];
  var required = {7:'Entrada',8:'Salida',17:'Estado',29:'Tipos normalizados',30:'Códigos de categoría'};
  Object.keys(required).forEach(function(col) {
    if (String(head[Number(col)-1] || '').trim() !== required[col]) {
      throw new Error('Columna no esperada en RESERVAS: ' + col);
    }
  });

  var n = Math.max(0, sheet.getLastRow() - 1);
  var unresolved = 0;
  if (n) {
    // Solo las columnas relevantes; NO recuperar la matriz de 35 columnas.
    var stay = sheet.getRange(2, 7, n, 6).getValues(); // G:L
    var state = sheet.getRange(2, 17, n, 1).getValues(); // Q
    var normalized = sheet.getRange(2, 29, n, 2).getValues(); // AC:AD
    for (var i = 0; i < n; i++) {
      var arrival = stay[i][0], departure = stay[i][1];
      if (!(arrival instanceof Date) || !(departure instanceof Date)) continue;
      var status = String(state[i][0] || '').toLowerCase();
      if (status.indexOf('cancel') >= 0 || status.indexOf('no_show') >= 0 ||
          status.indexOf('no show') >= 0 || status.indexOf('no-show') >= 0) continue;
      var checkin = dateKey_(arrival), checkout = dateKey_(departure);
      if (checkout <= today || checkin > dateKeys[days-1]) continue;

      var bookedRooms = Math.max(0, numberOrZero_(stay[i][3])); // J
      if (!bookedRooms) continue;
      var categories = rmsCategories_(normalized[i][0], normalized[i][1], bookedRooms, byCategory);
      if (!categories) { unresolved++; continue; }

      var firstDateIndex = Math.max(0, Math.floor((Date.parse(checkin + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000));
      for (var k = firstDateIndex; k < dateKeys.length && dateKeys[k] < checkout; k++) {
        var keyDate = dateKeys[k];
        categories.forEach(function(category) {
          occupancy[keyDate][category.code] = (occupancy[keyDate][category.code] || 0) + category.count;
        });
      }
    }
  }

  var calendar = [];
  dateKeys.forEach(function(date) {
    rooms.forEach(function(room) {
      var count = occupancy[date][room.code] || 0;
      calendar.push({
        id: date + '-' + room.code, date: date, roomCode: room.code,
        roomName: room.name, capacity: room.capacity,
        occupied: count, available: Math.max(0, room.capacity - count),
        occupancy: room.capacity ? count / room.capacity * 100 : 0,
        currentRate: null, recommendedRate: null, pickup7: null,
        demand: null, reason: null,
        overbooked: count > room.capacity
      });
    });
  });
  var payload = { calendar: calendar, reservationsWithoutCategory: unresolved,
    generatedAt: new Date().toISOString() };
  // Límite de CacheService: entradas de hasta 100 KB. Evitar fallar toda
  // la consulta por intentar cachear un calendario de 180 × 5 celdas.
  var serialized = JSON.stringify(payload);
  if (serialized.length < 90000) {
    cache.put(key, serialized, HMS_CONFIG.RMS_CACHE_SECONDS);
  }
  return payload;
}

function readRmsRoomCatalog_(ss) {
  var sheet = ss.getSheetByName(HMS_CONFIG.SHEETS.ROOM_CATALOG);
  if (!sheet) throw new Error('Falta CONFIGURACION.');
  var headers = sheet.getRange(18, 1, 1, 5).getDisplayValues()[0];
  if (headers[0] !== 'Habitación' || headers[1] !== 'Código de categoría' ||
      headers[2] !== 'Tipo de habitación' || headers[4] !== 'Activa') {
    throw new Error('No coincide el catálogo CONFIGURACION!A18:E18.');
  }
  var rows = sheet.getRange(19, 1, Math.max(1, Math.min(100, sheet.getLastRow()-18)), 5).getValues();
  var catalog = {};
  rows.forEach(function(row) {
    var code = String(row[1] || '').trim();
    if (!/^(NAY|NA|CHA|KAA|MUU)$/.test(code)) return;
    if (!/^(si|sí|true|1)$/i.test(String(row[4] || '').trim())) return;
    if (!catalog[code]) catalog[code] = { code: code, name: String(row[2] || code), capacity: 0 };
    catalog[code].capacity++;
  });
  return ['NAY','NA','CHA','KAA','MUU'].filter(function(code) {
    return !!catalog[code];
  }).map(function(code) { return catalog[code]; });
}

function rmsCategories_(types, codeValue, total, catalog) {
  // AC: "1 × CHA | 2 × NA". Nunca distribuir automáticamente entre
  // categorías múltiples cuando la fuente no indica cantidades fiables.
  var found = {};
  var pieces = String(types || '').split(/[|;,]/);
  pieces.forEach(function(part) {
    var match = part.match(/(\d+)\s*[×xX]\s*(NAY|NA|CHA|KAA|MUU)\b/i);
    if (match && catalog[match[2].toUpperCase()]) {
      var code = match[2].toUpperCase();
      found[code] = (found[code] || 0) + Number(match[1]);
    }
  });
  var categories = Object.keys(found).map(function(code) { return {code:code,count:found[code]}; });
  var totalParsed = categories.reduce(function(sum, row) { return sum + row.count; }, 0);
  if (categories.length && totalParsed === total) return categories;
  var single = String(codeValue || '').trim();
  if (catalog[single] && total === 1) return [{code:single,count:1}];
  return null;
}

function clearRmsCache() {
  CacheService.getScriptCache().remove(HMS_CONFIG.RMS_CACHE_KEY);
}

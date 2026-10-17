function getIndicators_(includeMonthly) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(HMS_CONFIG.INDICATORS_CACHE_KEY);
  var spreadsheet = null;
  var roomData;

  if (cached && !includeMonthly) {
    roomData = JSON.parse(cached);
  } else {
    spreadsheet = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    roomData = readRoomIndicators_(spreadsheet);
    cache.put(
      HMS_CONFIG.INDICATORS_CACHE_KEY,
      JSON.stringify(roomData),
      HMS_CONFIG.INDICATORS_CACHE_SECONDS
    );
  }

  var payload = {
    roomPerformance: roomData.roomPerformance,
    roomMonthly: roomData.roomMonthly,
    generatedAt: new Date().toISOString()
  };

  // An explicit refresh of Indicadores updates its shared monthly data in the
  // same browser request. Normal tab entry does not resend those rows.
  if (includeMonthly) {
    spreadsheet = spreadsheet || SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    payload.monthly = readMonthlySummary_(spreadsheet);
  }

  return payload;
}

function readRoomIndicators_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.ROOM_INDICATORS);
  if (!sheet) throw new Error('Falta la hoja ' + HMS_CONFIG.SHEETS.ROOM_INDICATORS + '.');

  var firstDataRow = 7;
  var rowCount = Math.max(0, sheet.getLastRow() - firstDataRow + 1);
  if (!rowCount) return { roomPerformance: [], roomMonthly: [] };

  var validCodes = { NAY: true, NA: true, CHA: true, KAA: true, MUU: true };
  var rows = sheet.getRange(firstDataRow, 1, rowCount, 12).getValues()
    .filter(function (row) {
      return row[0] instanceof Date && validCodes[String(row[3]).trim()] === true;
    })
    .map(function (row) {
      var year = numberOrZero_(row[1]);
      var month = numberOrZero_(row[2]);
      var code = String(row[3]).trim();
      var availableNights = numberOrZero_(row[6]);
      var soldNights = numberOrZero_(row[7]);
      var revenue = numberOrZero_(row[9]);

      return {
        key: year + '-' + String(month).padStart(2, '0') + '-' + code,
        year: year,
        month: month,
        code: code,
        name: String(row[4] || code),
        rooms: numberOrZero_(row[5]),
        soldNights: soldNights,
        availableNights: availableNights,
        revenue: revenue
      };
    });

  var todayMonth = Utilities.formatDate(new Date(), HMS_CONFIG.TIME_ZONE, 'yyyy-MM');
  var periods = rows.map(function (row) {
    return row.year + '-' + String(row.month).padStart(2, '0');
  }).filter(function (period, index, all) {
    return all.indexOf(period) === index && period <= todayMonth;
  }).sort();
  var selectedPeriod = periods.indexOf(todayMonth) >= 0 ? todayMonth : periods[periods.length - 1];
  var currentRows = rows.filter(function (row) {
    return row.year + '-' + String(row.month).padStart(2, '0') === selectedPeriod;
  });

  return {
    roomMonthly: rows.map(function (row) {
      return {
        key: row.key,
        year: row.year,
        month: row.month,
        code: row.code,
        soldNights: row.soldNights,
        availableNights: row.availableNights,
        revenue: row.revenue
      };
    }),
    roomPerformance: currentRows.map(function (row) {
      var occupancy = row.availableNights ? row.soldNights / row.availableNights * 100 : 0;
      var adr = row.soldNights ? row.revenue / row.soldNights : 0;
      var revpar = row.availableNights ? row.revenue / row.availableNights : 0;
      return {
        code: row.code,
        name: row.name,
        rooms: row.rooms,
        occupancy: occupancy,
        adr: adr,
        revpar: revpar,
        currentRate: adr
      };
    })
  };
}

/** Run manually after correcting room indicator data. */
function clearIndicatorsCache() {
  CacheService.getScriptCache().remove(HMS_CONFIG.INDICATORS_CACHE_KEY);
}

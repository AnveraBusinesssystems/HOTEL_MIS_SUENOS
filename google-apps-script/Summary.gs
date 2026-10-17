function getSummary_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(HMS_CONFIG.SUMMARY_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var spreadsheet = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var monthly = readMonthlySummary_(spreadsheet);
  var daily = readDailyOperation_(spreadsheet);
  var today = todayKey_();

  var payload = {
    monthly: monthly,
    performance: daily
      .filter(function (row) { return row.date <= today; })
      .slice(-14)
      .map(function (row) {
        return { date: row.date, ingresos: row.revenue, ocupacion: row.occupancy };
      }),
    rateDays: daily
      .filter(function (row) { return row.date >= today; })
      .slice(0, 7)
      .map(function (row) {
        return {
          date: row.date,
          occupancy: row.occupancy,
          occupied: row.occupied,
          available: Math.max(0, row.capacity - row.occupied)
        };
      }),
    generatedAt: new Date().toISOString()
  };

  cache.put(HMS_CONFIG.SUMMARY_CACHE_KEY, JSON.stringify(payload), HMS_CONFIG.CACHE_SECONDS);
  return payload;
}

function readMonthlySummary_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.INDICATORS);
  if (!sheet) throw new Error('Falta la hoja ' + HMS_CONFIG.SHEETS.INDICATORS + '.');

  var firstDataRow = 7;
  var rowCount = Math.max(0, sheet.getLastRow() - firstDataRow + 1);
  if (!rowCount) return [];

  return sheet.getRange(firstDataRow, 1, rowCount, 15).getValues()
    .filter(function (row) { return row[0] instanceof Date; })
    .map(function (row) {
      var key = monthKey_(row[0]);
      var parts = key.split('-');
      return {
        key: key,
        year: Number(parts[0]),
        month: Number(parts[1]),
        label: monthLabel_(row[0]),
        revenue: numberOrZero_(row[4]),
        soldNights: numberOrZero_(row[2]),
        availableNights: numberOrZero_(row[1]),
        bookings: numberOrZero_(row[7]),
        cancellations: numberOrZero_(row[8]),
        costs: 0,
        costsAvailable: false,
        forecastRevenue: 0,
        forecastOccupancy: 0
      };
    });
}

function readDailyOperation_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(HMS_CONFIG.SHEETS.DAILY_OPERATION);
  if (!sheet) throw new Error('Falta la hoja ' + HMS_CONFIG.SHEETS.DAILY_OPERATION + '.');

  var firstDataRow = 7;
  var rowCount = Math.max(0, sheet.getLastRow() - firstDataRow + 1);
  if (!rowCount) return [];

  return sheet.getRange(firstDataRow, 1, rowCount, 18).getValues()
    .filter(function (row) { return row[0] instanceof Date; })
    .map(function (row) {
      return {
        date: dateKey_(row[0]),
        capacity: numberOrZero_(row[2]),
        occupied: numberOrZero_(row[3]),
        occupancy: numberOrZero_(row[4]) * 100,
        revenue: numberOrZero_(row[13])
      };
    })
    .sort(function (a, b) { return a.date.localeCompare(b.date); });
}

/** Run manually after correcting source data if an immediate refresh is needed. */
function clearSummaryCache() {
  CacheService.getScriptCache().remove(HMS_CONFIG.SUMMARY_CACHE_KEY);
}

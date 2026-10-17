function parseRequest_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error('Solicitud vacía.');
  }

  var request = JSON.parse(event.postData.contents);
  if (!request || typeof request.action !== 'string') {
    throw new Error('La solicitud no contiene una acción válida.');
  }
  return request;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function numberOrZero_(value) {
  var number = Number(value);
  return isFinite(number) ? number : 0;
}

function dateKey_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, HMS_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function monthKey_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, HMS_CONFIG.TIME_ZONE, 'yyyy-MM');
}

function monthLabel_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  var months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function todayKey_() {
  return Utilities.formatDate(new Date(), HMS_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

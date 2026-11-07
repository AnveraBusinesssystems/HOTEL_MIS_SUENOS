/**
 * Lectores comunes para Operación diaria y la futura sección Caja.
 * No registran cobros ni modifican datos.
 */
function readHotelCashMovements_(ss) {
  var sh = ss.getSheetByName('MOVIMIENTOS_CAJA');
  if (!sh) throw new Error('Falta MOVIMIENTOS_CAJA.');
  var h = sh.getRange(5,1,1,21).getDisplayValues()[0];
  if (h[0] !== 'ID movimiento' || h[2] !== 'Fecha operativa' ||
      h[3] !== 'Movimiento' || h[8] !== 'Monto' || h[13] !== 'Estado')
    throw new Error('Encabezados de MOVIMIENTOS_CAJA inesperados.');
  var count = Math.max(0,sh.getLastRow()-5);
  if (!count) return [];
  var rows = sh.getRange(6,1,count,21).getValues();
  return rows.filter(function(r){return r[0] && r[3];}).map(function(r){
    var sourceType = String(r[3] || '').trim();
    if (sourceType !== 'Entrada' && sourceType !== 'Salida') return null;
    var type = sourceType;
    var method = String(r[7] || '').trim();
    if (['Efectivo','Tarjeta','Transferencia'].indexOf(method) < 0) method='Sin registro';
    var category = String(r[4] || '');
    var known = ['Pago de reserva','Anticipo de reserva','Venta de restaurante','Otro ingreso',
      'Compra de inventario','Mantenimiento','Lavandería','Servicios','Reembolso',
      'Retiro de efectivo','Gastos externos','Otro gasto','Cobro de tour',
      'Pago a proveedor de tour','Comisión de tour a recepción'];
    if (known.indexOf(category)<0) category='Sin clasificar';
    var sourceArea = String(r[5] || '').trim();
    var validAreas = ['Reservas','Recepción','Restaurante','Lavandería','Limpieza','Mantenimiento','Administración','Otros'];
    var area = validAreas.indexOf(sourceArea)>=0 ? sourceArea :
      /recepci[oó]n/i.test(sourceArea) ? 'Recepción' : 'Otros';
    return {
      id:String(r[0]), date:r[2] instanceof Date ? dateKey_(r[2]) : String(r[2] || '').slice(0,10),
      time:r[1] instanceof Date ? Utilities.formatDate(r[1],HMS_CONFIG.TIME_ZONE,'HH:mm'):'',
      type:type, amount:numberOrZero_(r[8]), paymentMethod:method,
      area:area, category:category,
      description:String(r[6] || ''), status:/anulad/i.test(String(r[13]))?'Anulado':'Registrado',
      createdBy:String(r[12] || ''),
      reservationId:String(r[9] || '') || undefined,
      tourId:String(r[10] || '') || undefined,
      purchaseId:String(r[11] || '') || undefined
    };
  }).filter(function(r) {return !!r;});
}

function readHotelTours_(ss) {
  var sh = ss.getSheetByName('TOURS');
  if (!sh) throw new Error('Falta TOURS.');
  var h = sh.getRange(5,1,1,22).getDisplayValues()[0];
  if (h[0] !== 'ID tour' || h[2] !== 'Fecha del tour' ||
      h[7] !== 'Precio de venta' || h[19] !== 'Estado')
    throw new Error('Encabezados de TOURS inesperados.');
  var count = Math.max(0,sh.getLastRow()-5);
  if (!count) return [];
  return sh.getRange(6,1,count,22).getValues().filter(function(r){return r[0];}).map(function(r){
    var sale = numberOrZero_(r[7]);
    var collected = numberOrZero_(r[12]);
    var collectedKnown = r[12] !== '' && r[12] !== null;
    var paid = collectedKnown && sale>0 && collected>=sale;
    var status = String(r[19] || 'Agendado').trim();
    if (['Agendado','Realizado','Cancelado'].indexOf(status)<0) status='Agendado';
    return {
      id:String(r[0]), reservationId:String(r[5] || '') || undefined,
      guestName:String(r[4] || ''), tourType:String(r[3] || ''),
      provider:'', // La hoja TOURS no tiene campo de proveedor identificado.
      serviceDate:r[2] instanceof Date?dateKey_(r[2]):String(r[2]||'').slice(0,10),
      serviceTime:'', // B representa fecha/hora de alta, no horario confirmado del servicio.
      people:0, // No existe columna de número de participantes.
      salePrice:sale, providerAmount:numberOrZero_(r[8]),
      status:status, paymentStatus:!collectedKnown ? 'Sin registro' : paid?'Pagado':'Pendiente',
      providerSettlementStatus:r[15]==='' || r[15]===null ? 'Sin registro' : numberOrZero_(r[15])<=0?'Liquidado':'Pendiente',
      receptionCommissionStatus:r[16]==='' || r[16]===null ? 'Sin registro' : numberOrZero_(r[16])<=0?'Pagada':'Pendiente',
      settlementDueDate:'', // Plazo no registrado en la hoja.
      createdAt:r[1] instanceof Date?Utilities.formatDate(r[1],HMS_CONFIG.TIME_ZONE,"yyyy-MM-dd HH:mm"):'',
      createdBy:String(r[18] || ''), notes:String(r[20] || '') || undefined
    };
  });
}

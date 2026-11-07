/** Caja: única fuente MOVIMIENTOS_CAJA + CIERRES_CAJA. */
function getCash_(refresh) {
  var cache = CacheService.getScriptCache();
  var key = HMS_CONFIG.CASH_CACHE_KEY;
  var cached = !refresh && cache.get(key);
  if (cached) return JSON.parse(cached);
  var ss = SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
  var movements = readHotelCashMovements_(ss);
  var closures = cashSheet_(ss, 'CIERRES_CAJA',
    ['ID cierre','Fecha operativa','Saldo inicial','Entradas efectivo','Salidas efectivo','Efectivo esperado',
    'Efectivo contado','Diferencia','Entradas tarjeta','Salidas tarjeta','Entradas transferencia',
    'Salidas transferencia','Total entradas','Total salidas','Neto del día','Cerrado por',
    'Fecha y hora de cierre','Estado','Revisado por','Nota']);
  var count = Math.max(0, closures.getLastRow()-5);
  var rows = count ? closures.getRange(6,1,count,20).getValues() : [];
  var days = rows.filter(function(r) {return r[0] && r[1] instanceof Date;}).map(function(r){
    return {date:dateKey_(r[1]), openingCash:numberOrZero_(r[2]),
      countedCash:r[6] === '' || r[6] === null ? undefined : numberOrZero_(r[6]),
      closed:r[17] === 'Cerrado', closeId:String(r[0])};
  });
  var payload = {cashMovements:movements,cashDays:days,generatedAt:new Date().toISOString()};
  var serialized = JSON.stringify(payload);
  if (serialized.length < 90000) cache.put(key,serialized,HMS_CONFIG.CASH_CACHE_SECONDS);
  return payload;
}
function cashSheet_(ss,name,headers) {
  var sheet=ss.getSheetByName(name);
  if (!sheet) throw new Error('Falta '+name+'.');
  var actual=sheet.getRange(5,1,1,headers.length).getDisplayValues()[0];
  headers.forEach(function(h,i){if (String(actual[i]||'').trim()!==h) throw new Error(name+' columna '+(i+1)+' incompatible.');});
  return sheet;
}
function cashNextRow_(sheet,col) {
  var n=Math.max(0,sheet.getLastRow()-5);
  if (!n) return 6;
  var vals=sheet.getRange(6,col,n,1).getValues();
  for(var i=vals.length-1;i>=0;i--) if(vals[i][0]!=='' && vals[i][0]!==null) return i+7;
  return 6;
}
function cashMovementRow_(sheet,id) {
  var last=sheet.getLastRow();
  if(last<6) return 0;
  var found=sheet.getRange(6,1,last-5,1).createTextFinder(id).matchEntireCell(true).findNext();
  return found?found.getRow():0;
}
function cashDate_(value) {
  var text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Fecha operativa inválida.');
  var date=new Date(text+'T12:00:00Z');
  if(isNaN(date.getTime()) || Utilities.formatDate(date,'UTC','yyyy-MM-dd')!==text) throw new Error('Fecha inexistente.');
  return date;
}
function cashInvalidate_() {
  var c=CacheService.getScriptCache();
  c.remove(HMS_CONFIG.CASH_CACHE_KEY);
  c.remove(HMS_CONFIG.OPERATION_CACHE_KEY);
}
/** 
 * Registros independientes: nunca registrar aquí pagos de Reservas, Tours
 * ni compras de inventario. Cada uno requiere un contrato que reconcilie
 * las hojas afectadas y se implementa por su ruta específica.
 */
function registerCashMovement_(request) {
  var m=request.movement||{}, id=String(request.movementId||'').trim();
  var amount=Number(m.amount), type=String(m.type||''), category=String(m.category||'');
  var method=String(m.paymentMethod||''), desc=String(m.description||'').trim();
  var valid={
    'Entrada':['Venta de restaurante','Otro ingreso'],
    'Salida':['Mantenimiento','Lavandería','Servicios','Gastos externos','Retiro de efectivo','Otro gasto']
  };
  if(!/^HMS-CASH-[a-zA-Z0-9-]{8,}$/.test(id) || !valid[type] ||
      valid[type].indexOf(category)<0 || !isFinite(amount) || amount<=0 ||
      Math.abs(Math.round(amount*100)-amount*100)>0.00001 ||
      ['Efectivo','Tarjeta','Transferencia'].indexOf(method)<0 || !desc || desc.length>250)
    throw new Error('Movimiento inválido o requiere una ruta especializada.');
  var date=String(m.date||'');
  cashDate_(date);
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var ledger=cashSheet_(ss,'MOVIMIENTOS_CAJA',
      ['ID movimiento','Fecha y hora','Fecha operativa','Movimiento','Categoría',
      'Departamento','Concepto','Método de pago','Monto','Clave de reserva','ID tour',
      'ID de compra','Usuario','Estado','Comprobante','Nota','Actualizado',
      'Cancelado por','Fecha de cancelación','Motivo de cancelación','Origen']);
    var existing=cashMovementRow_(ledger,id);
    if(existing) {
      var old=ledger.getRange(existing,1,1,21).getValues()[0];
      if(old[3]===type && old[4]===category && old[7]===method &&
        numberOrZero_(old[8])===amount && String(old[6])===desc &&
        (old[2] instanceof Date ? dateKey_(old[2]) : String(old[2]))===date) return {movementId:id,duplicate:true};
      throw new Error('ID existente con distinto contenido; conciliar.');
    }
    var dept={'Venta de restaurante':'Restaurante','Otro ingreso':'Recepción',
      'Mantenimiento':'Mantenimiento','Lavandería':'Lavandería',
      'Servicios':'Administración','Gastos externos':'Administración',
      'Retiro de efectivo':'Administración','Otro gasto':'Otros'}[category];
    var now=new Date(), row=new Array(21).fill('');
    row[0]=id;row[1]=now;row[2]=cashDate_(date);row[3]=type;row[4]=category;row[5]=dept;
    row[6]=desc;row[7]=method;row[8]=amount;row[12]='Sistema HMS';
    row[13]='Activo';row[16]=now;row[20]='Caja Web';
    if(cashDayClosed_(ss,date)) throw new Error('El día está cerrado.');
    var target=cashNextRow_(ledger,1);
    ledger.getRange(target,1,1,21).setValues([row]);
    cashInvalidate_();
    return {movementId:id,duplicate:false};
  }finally{lock.releaseLock();}
}
/** Solo movimientos independientes: una anulación de reserva/tour/inventario
 * debe conciliar también su origen, no basta con cambiar N en Caja.
 */
function annulCashMovement_(request) {
  var id=String(request.movementId||'').trim();
  var reason=String(request.reason||'Corrección administrativa').trim();
  if(!id || !reason || reason.length>250) throw new Error('ID o motivo inválido.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var sh=cashSheet_(ss,'MOVIMIENTOS_CAJA',
      ['ID movimiento','Fecha y hora','Fecha operativa','Movimiento','Categoría',
      'Departamento','Concepto','Método de pago','Monto','Clave de reserva','ID tour',
      'ID de compra','Usuario','Estado','Comprobante','Nota','Actualizado',
      'Cancelado por','Fecha de cancelación','Motivo de cancelación','Origen']);
    var row=cashMovementRow_(sh,id);
    if(!row) throw new Error('Movimiento no encontrado.');
    var vals=sh.getRange(row,1,1,21).getValues()[0];
    if(vals[13]==='Anulado') return {movementId:id,duplicate:true};
    if(vals[13]!=='Activo') throw new Error('Movimiento sin estado Activo.');
    if(cashDayClosed_(ss, vals[2] instanceof Date ? dateKey_(vals[2]) : String(vals[2]))) throw new Error('El día está cerrado.');
    if(vals[9] || vals[10] || vals[11] ||
      ['Pago de reserva','Anticipo de reserva','Compra de inventario',
        'Cobro de tour','Pago a proveedor de tour','Comisión de tour a recepción'].indexOf(String(vals[4]))>=0)
      throw new Error('Anular desde el módulo de origen para conservar conciliación.');
    var now=new Date();
    sh.getRange(row,14).setValue('Anulado');
    sh.getRange(row,18,1,3).setValues([['Sistema HMS',now,reason]]);
    sh.getRange(row,17).setValue(now);
    cashInvalidate_();
    return {movementId:id,duplicate:false};
  }finally{lock.releaseLock();}
}
/** Fondo inicial y conteo sobre CIERRES_CAJA. D:F, H:O son fórmulas protegidas. */
function saveCashDay_(request) {
  var date=String(request.date||''),opening=request.openingCash, counted=request.countedCash;
  cashDate_(date);
  if(opening===undefined && counted===undefined) throw new Error('No hay importes para guardar.');
  if(opening!==undefined && (!isFinite(Number(opening)) || Number(opening)<0)) throw new Error('Fondo inválido.');
  if(counted!==undefined && (!isFinite(Number(counted)) || Number(counted)<0)) throw new Error('Conteo inválido.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var sh=cashSheet_(ss,'CIERRES_CAJA',
      ['ID cierre','Fecha operativa','Saldo inicial','Entradas efectivo','Salidas efectivo','Efectivo esperado',
      'Efectivo contado','Diferencia','Entradas tarjeta','Salidas tarjeta','Entradas transferencia',
      'Salidas transferencia','Total entradas','Total salidas','Neto del día','Cerrado por',
      'Fecha y hora de cierre','Estado','Revisado por','Nota']);
    var existing=cashClosureRow_(sh,date);
    var row=existing||cashNextRow_(sh,2);
    if(existing && String(sh.getRange(row,18).getValue())==='Cerrado')
      throw new Error('El cierre está cerrado; requiere reapertura administrativa.');
    if(!existing) {
      if(opening===undefined) throw new Error('Registra primero el fondo inicial.');
      var key='CIERRE-'+date.replace(/-/g,'');
      sh.getRange(row,1,1,3).setValues([[key,cashDate_(date),Number(opening)]]);
      sh.getRange(row,18).setValue('Abierto');
    }else if(opening!==undefined)sh.getRange(row,3).setValue(Number(opening));
    if(counted!==undefined)sh.getRange(row,7).setValue(Number(counted));
    cashInvalidate_();
    return {date:date,saved:true};
  }finally{lock.releaseLock();}
}

/** Busca un cierre por fecha sin depender del último renglón con fórmulas. */
function cashClosureRow_(sheet,day) {
  var n=Math.max(0,sheet.getLastRow()-5);
  if(!n) return 0;
  var vals=sheet.getRange(6,2,n,1).getValues();
  for(var i=0;i<vals.length;i++) {
    var d=vals[i][0] instanceof Date ? dateKey_(vals[i][0]) : String(vals[i][0]||'');
    if(d===day) return i+6;
  }
  return 0;
}
function cashDayClosed_(ss,day) {
  var sheet=ss.getSheetByName('CIERRES_CAJA');
  if(!sheet) throw new Error('Falta CIERRES_CAJA.');
  var row=cashClosureRow_(sheet,day);
  return row>0 && String(sheet.getRange(row,18).getValue()).trim()==='Cerrado';
}
/** Cierra un día después del conteo, conservando las fórmulas de D:O. */
function closeCashDay_(request) {
  var day=String(request.date||''), note=String(request.note||'').trim();
  cashDate_(day);
  if(note.length>500) throw new Error('Nota demasiado larga.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var sh=ss.getSheetByName('CIERRES_CAJA');
    if(!sh) throw new Error('Falta CIERRES_CAJA.');
    var row=cashClosureRow_(sh,day);
    if(!row) throw new Error('Primero registra el fondo inicial y el conteo del día.');
    if(String(sh.getRange(row,18).getValue()).trim()==='Cerrado') return {date:day,closed:true,duplicate:true};
    if(sh.getRange(row,7).getValue()==='') throw new Error('Primero registra el efectivo contado.');
    SpreadsheetApp.flush();
    var difference=Number(sh.getRange(row,8).getValue());
    if(!isFinite(difference)) throw new Error('La diferencia de caja no está calculada.');
    if(Math.abs(difference)>0.009 && !request.acceptDifference)
      throw new Error('Existe una diferencia de caja; se requiere aceptación expresa.');
    if(Math.abs(difference)>0.009 && !note)
      throw new Error('Explica el motivo de la diferencia de caja.');
    var now=new Date();
    sh.getRange(row,16,1,3).setValues([['Sistema HMS',now,'Cerrado']]);
    sh.getRange(row,20).setValue(note);
    cashInvalidate_();
    return {date:day,closed:true,duplicate:false,difference:difference};
  }finally{lock.releaseLock();}
}

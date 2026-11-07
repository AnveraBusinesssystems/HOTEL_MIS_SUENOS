/**
 * Cobros y liquidaciones de tours existentes.
 * Reutiliza PAGOS_TOURS como historial y TOURS!J:R como cálculos; NUNCA
 * sobrescribe las fórmulas de TOURS. Un pago genera también un movimiento
 * de Caja en la misma fecha y con el mismo eventId.
 */
function recordTourPayment_(request) {
  var tourId=String(request.tourId||'').trim();
  var kind=String(request.kind||'').trim();
  var method=String(request.method||'').trim();
  var eventId=String(request.eventId||'').trim();
  var amount=Number(request.amount);
  var categories={
    'Cobro huésped':{movement:'Entrada',category:'Cobro de tour',dept:'Recepción'},
    'Pago proveedor':{movement:'Salida',category:'Pago a proveedor de tour',dept:'Administración'},
    'Pago recepción':{movement:'Salida',category:'Comisión de tour a recepción',dept:'Administración'},
    'Pago hotel':{movement:'Salida',category:'Pago al hotel por tour',dept:'Administración'}
  };
  if(!tourId || !/^HMS-TOUR-[a-zA-Z0-9-]{8,}$/.test(eventId) || !categories[kind] ||
      ['Efectivo','Tarjeta','Transferencia'].indexOf(method)<0 ||
      !isFinite(amount) || amount<=0 || Math.abs(Math.round(amount*100)-amount*100)>0.00001)
    throw new Error('Datos de pago del tour inválidos.');
  var lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var tours=cashSheet_(ss,'TOURS',
      ['ID tour','Fecha y hora','Fecha del tour','Tour','Huésped','Clave de reserva',
       'Cobrado por','Precio de venta','Costo proveedor','Comisión repartible','Parte hotel',
       'Parte recepción','Total cobrado','Saldo por cobrar','Estado de cobro',
       'Pendiente proveedor','Pendiente recepción','Pendiente hotel','Usuario','Estado','Nota','Actualizado']);
    var journal=cashSheet_(ss,'PAGOS_TOURS',
      ['ID pago tour','Fecha y hora','Fecha operativa','ID tour','Tipo de movimiento',
       'Método de pago','Monto','ID movimiento de caja','Usuario','Estado',
       'Comprobante','Nota','Actualizado']);
    var ledger=cashSheet_(ss,'MOVIMIENTOS_CAJA',
      ['ID movimiento','Fecha y hora','Fecha operativa','Movimiento','Categoría',
       'Departamento','Concepto','Método de pago','Monto','Clave de reserva','ID tour',
       'ID de compra','Usuario','Estado','Comprobante','Nota','Actualizado',
       'Cancelado por','Fecha de cancelación','Motivo de cancelación','Origen']);
    var found=tours.getRange(6,1,Math.max(1,tours.getLastRow()-5),1)
      .createTextFinder(tourId).matchEntireCell(true).findNext();
    if(!found) throw new Error('Tour no encontrado.');
    var tour=tours.getRange(found.getRow(),1,1,22).getValues()[0];
    var source=categories[kind], date=todayKey_();
    var oldCash=cashMovementRow_(ledger,eventId);
    var oldPayment=journal.getLastRow()>=6 ? journal.getRange(6,1,journal.getLastRow()-5,1)
      .createTextFinder(eventId).matchEntireCell(true).findNext() : null;
    if(oldCash || oldPayment) {
      if(!oldCash || !oldPayment) throw new Error('Pago incompleto entre Caja y PAGOS_TOURS: conciliar antes de reintentar.');
      var prev=journal.getRange(oldPayment.getRow(),1,1,13).getValues()[0];
      if(String(prev[3])===tourId && String(prev[4])===kind &&
         String(prev[5])===method && numberOrZero_(prev[6])===amount &&
         String(prev[7])===eventId && String(prev[9])==='Activo') {
        return {tourId:tourId,eventId:eventId,duplicate:true};
      }
      throw new Error('Identificador del pago ya utilizado con valores diferentes.');
    }
    if(String(tour[19]).toLowerCase()==='cancelado') throw new Error('Tour cancelado.');
    if(cashDayClosed_(ss,date)) throw new Error('El día de Caja está cerrado.');
    var index={'Cobro huésped':13,'Pago proveedor':15,'Pago recepción':16,'Pago hotel':17}[kind];
    var balance=numberOrZero_(tour[index]);
    if(balance<=0 || amount>balance+0.001) throw new Error('El importe supera el saldo pendiente del tour.');
    if(kind==='Pago recepción' && String(tour[6])!=='Hotel')
      throw new Error('Este tour no fue cobrado por el Hotel.');
    if(kind==='Pago hotel' && String(tour[6])!=='Recepción')
      throw new Error('Este tour no fue cobrado por Recepción.');
    if(kind!=='Cobro huésped' && String(tour[19])!=='Realizado')
      throw new Error('El tour debe estar realizado antes de su liquidación.');
    var now=new Date(), operational=cashDate_(date),cashRow=cashNextRow_(ledger,1),
        payRow=cashNextRow_(journal,1);
    var c=new Array(21).fill('');
    c[0]=eventId;c[1]=now;c[2]=operational;c[3]=source.movement;
    c[4]=source.category;c[5]=source.dept;c[6]=kind+' · '+tourId;
    c[7]=method;c[8]=amount;c[9]=tour[5]||'';c[10]=tourId;
    c[12]='Sistema HMS';c[13]='Activo';c[16]=now;c[20]='Tours Web';
    var p=[eventId,now,operational,tourId,kind,method,amount,eventId,
      'Sistema HMS','Activo','','Registro desde HMS',now];
    try {
      ledger.getRange(cashRow,1,1,21).setValues([c]);
      journal.getRange(payRow,1,1,13).setValues([p]);
      SpreadsheetApp.flush();
    }catch(error){
      try {
        ledger.getRange(cashRow,1,1,21).clearContent();
        journal.getRange(payRow,1,1,13).clearContent();
      }catch(rollback) { console.error('CONCILIACION MANUAL PAGO TOUR '+eventId+': '+rollback); }
      throw error;
    }
    cashInvalidate_();
    return {tourId:tourId,eventId:eventId,duplicate:false};
  }finally{lock.releaseLock();}
}
/** Cambiar el estado real del tour solo en TOURS!T; prohibir cancelaciones con cobros. */
function updateTourStatus_(request) {
  var id=String(request.tourId||'').trim(),status=String(request.status||'');
  if(!id || ['Agendado','Realizado','Cancelado'].indexOf(status)<0)throw new Error('Actualización inválida.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var ss=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID), sh=ss.getSheetByName('TOURS');
    if(!sh)throw new Error('Falta TOURS.');
    var found=sh.getRange(6,1,Math.max(1,sh.getLastRow()-5),1)
      .createTextFinder(id).matchEntireCell(true).findNext();
    if(!found)throw new Error('Tour no encontrado.');
    var row=sh.getRange(found.getRow(),1,1,22).getValues()[0];
    if(status==='Cancelado' && numberOrZero_(row[12])>0)
      throw new Error('Primero concilia reembolso del huésped antes de cancelar.');
    if(String(row[19])==='Cancelado' && status!=='Cancelado')
      throw new Error('Reactivar un tour cancelado requiere revisión administrativa.');
    sh.getRange(found.getRow(),20).setValue(status);
    sh.getRange(found.getRow(),22).setValue(new Date());
    cashInvalidate_();
    return {tourId:id,status:status};
  }finally{lock.releaseLock();}
}

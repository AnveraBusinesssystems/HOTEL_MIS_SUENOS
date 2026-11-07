/**
 * Compra de inventario + salida de Caja.
 * Dos spreadsheets: NO hay atomicidad. Un ID común permite conciliar.
 * No inventar solicitudes de compra ni modificar fórmula de stock o PAR.
 */
function inventoryLastTransactionRow_(sheet) {
  var n=Math.min(Math.max(0,sheet.getLastRow()-2),998);
  if(!n)return 2;
  var cells=sheet.getRange(3,1,n,1).getValues();
  for(var i=cells.length-1;i>=0;i--)if(cells[i][0]!==''&&cells[i][0]!==null)return i+3;
  return 2;
}
function inventoryTransactionFormula_(sheet,row) {
  var cells=sheet.getRange(row,5,1,2);
  var values=cells.getValues()[0],formulas=cells.getFormulas()[0];
  if(!formulas[0] && (values[0]===''||values[0]===null))
    sheet.getRange(row,5).setFormula('=IF(C'+row+'="","",VLOOKUP(C'+row+",'Master products'!A:C,3,0))");
  if(!formulas[1] && (values[1]===''||values[1]===null))
    sheet.getRange(row,6).setFormula('=IFERROR(G'+row+'/D'+row+',0)');
}
function recordInventoryPurchase_(request) {
  var id=String(request.purchaseId||'').trim(),items=request.items;
  var method=String(request.method||''), description=String(request.description||'').trim();
  var supplier=String(request.supplier||'').trim().slice(0,100);
  var place=String(request.place||'').trim().slice(0,100);
  if(!/^HMS-BUY-[a-zA-Z0-9-]{8,}$/.test(id) ||
     !Array.isArray(items)||items.length<1||items.length>40 ||
     !['Efectivo','Tarjeta','Transferencia'].includes(method)||
     !description||description.length>250)
    throw new Error('Compra inválida.');
  var total=0,seen={};
  items=items.map(function(item) {
    var product=String(item.product||'').trim();
    var quantity=Number(item.quantity),amount=Number(item.total);
    var unit=String(item.unit||'').trim();
    if(!product||seen[product]||!isFinite(quantity)||quantity<=0||
       !isFinite(amount)||amount<0||Math.abs(quantity*100-Math.round(quantity*100))>0.00001||
       Math.abs(amount*100-Math.round(amount*100))>0.00001)
      throw new Error('Producto, cantidad o importe inválido: '+product);
    seen[product]=true;
    total+=amount;
    return {product:product,quantity:quantity,unit:unit,total:amount};
  });
  total=Math.round(total*100)/100;
  if(total<=0)throw new Error('La factura no tiene importe.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var inv=inventoryBook_(),hms=SpreadsheetApp.openById(HMS_CONFIG.SPREADSHEET_ID);
    var tx=inv.getSheetByName('Transacciones'),master=inv.getSheetByName('Master products');
    inventoryHeaders_(tx,2,['FECHA','TIPO','PRODUCTO','CANTIDAD','UNIDAD','PRECIO_UNITARIO','COSTO_TOTAL','PROVEEDOR','DONDE','NOTAS']);
    inventoryHeaders_(master,2,['PRODUCTO','CATEGORIA','UNIDAD','NIVEL','ALIAS','STATUS','ACEPTAR?','NOTAS']);
    var ledger=cashSheet_(hms,'MOVIMIENTOS_CAJA',
      ['ID movimiento','Fecha y hora','Fecha operativa','Movimiento','Categoría',
       'Departamento','Concepto','Método de pago','Monto','Clave de reserva',
       'ID tour','ID de compra','Usuario','Estado','Comprobante','Nota',
       'Actualizado','Cancelado por','Fecha de cancelación','Motivo de cancelación','Origen']);
    var active={};
    master.getRange(3,1,Math.max(1,master.getLastRow()-2),8).getValues().forEach(function(r){
      if(String(r[5]||'').trim().toLowerCase()==='active'&&r[0])
        active[String(r[0]).trim()]=String(r[2]||'').trim();
    });
    items.forEach(function(item) {
      if(!Object.prototype.hasOwnProperty.call(active,item.product))
        throw new Error('Producto no activo: '+item.product);
      if(item.unit&&active[item.product]!==item.unit)
        throw new Error('Unidad incorrecta para '+item.product);
    });
    var cashMatch=cashMovementRow_(ledger,id);
    var last=inventoryLastTransactionRow_(tx);
    var inventoryRows=last>=3?tx.getRange(3,10,last-2,1).getValues():[];
    var matching=inventoryRows.map(function(v,i){
      return String(v[0]||'').indexOf('ID:'+id)!==-1?i+3:0;
    }).filter(function(n){return n>0;});
    if(cashMatch||matching.length) {
      if(!cashMatch || matching.length!==items.length)
        throw new Error('Compra parcialmente registrada en Inventory y Caja. Conciliar antes de reintentar.');
      var oldCash=ledger.getRange(cashMatch,1,1,21).getValues()[0];
      if(String(oldCash[11])!==id||String(oldCash[13])!=='Activo'||
         numberOrZero_(oldCash[8])!==total||String(oldCash[7])!==method)
        throw new Error('Compra ya existe con datos distintos.');
      var persisted=matching.map(function(row){return tx.getRange(row,1,1,10).getValues()[0];});
      var same=items.every(function(item,i) {
        return persisted.some(function(v){
          return String(v[2])===item.product && numberOrZero_(v[3])===item.quantity &&
            numberOrZero_(v[6])===item.total && String(v[1])==='compras';
        });
      });
      if(!same)throw new Error('Los productos de la compra registrada no coinciden.');
      return {purchaseId:id,duplicate:true,amount:total};
    }
    var date=todayKey_();
    if(cashDayClosed_(hms,date))throw new Error('Caja está cerrada para la fecha actual.');
    var target=last+1;
    if(target+items.length-1>1000)
      throw new Error('Inventory: se alcanzó fila 1000 de Transacciones; ampliar rango de las fórmulas antes de seguir.');
    var cashTarget=cashNextRow_(ledger,1);
    var now=new Date(),operational=cashDate_(date);
    var cash=new Array(21).fill('');
    cash[0]=id;cash[1]=now;cash[2]=operational;cash[3]='Salida';
    cash[4]='Compra de inventario';cash[5]='Administración';cash[6]=description;
    cash[7]=method;cash[8]=total;cash[11]=id;cash[12]='Sistema HMS';
    cash[13]='Activo';cash[15]='COMPRA EN Inventory | ID:'+id;
    cash[16]=now;cash[20]='Inventario Web';
    var written=0,cashWritten=false;
    try {
      items.forEach(function(item,i) {
        var n=target+i;
        tx.getRange(n,1,1,4).setValues([[operational,'compras',item.product,item.quantity]]);
        tx.getRange(n,7,1,4).setValues([[item.total,supplier,place,
          'COMPRA HMS | ID:'+id+' | producto:'+item.product]]);
        inventoryTransactionFormula_(tx,n);
        written++;
      });
      SpreadsheetApp.flush();
      ledger.getRange(cashTarget,1,1,21).setValues([cash]);cashWritten=true;
      SpreadsheetApp.flush();
    } catch(error) {
      try{
        if(cashWritten) ledger.getRange(cashTarget,1,1,21).clearContent();
        for(var j=0;j<written;j++){
          tx.getRange(target+j,1,1,4).clearContent();
          tx.getRange(target+j,7,1,4).clearContent();
        }
      }catch(rollback){
        console.error('CONCILIACION MANUAL COMPRA '+id+': '+rollback);
      }
      throw error;
    }
    inventoryClearCache_();cashInvalidate_();
    return {purchaseId:id,duplicate:false,amount:total};
  }finally{lock.releaseLock();}
}

/** Detalle de compras registradas por la web, visible en Caja. */
function readInventoryPurchaseDetails_() {
  var ss=inventoryBook_(),tx=ss.getSheetByName('Transacciones');
  if(!tx)return {};
  var last=inventoryLastTransactionRow_(tx);
  if(last<3)return {};
  var rows=tx.getRange(3,1,last-2,10).getValues();
  var byId={};
  rows.forEach(function(r){
    var note=String(r[9]||''), match=note.match(/COMPRA HMS \| ID:(HMS-BUY-[\w-]+)/);
    if(!match||String(r[1])!=='compras')return;
    var id=match[1];
    if(!byId[id])byId[id]=[];
    byId[id].push({
      product:String(r[2]||''),quantity:numberOrZero_(r[3]),
      unit:String(r[4]||''),total:numberOrZero_(r[6])
    });
  });
  return byId;
}

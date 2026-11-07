/**
 * Inventario del hotel. Fuente de verdad: segunda hoja Inventory.
 * La pestaña Inventario A:G y Par Calc contienen fórmulas: solo lectura.
 * Ajustes físicos usan Transacciones B="compras" o B="uso" para que
 * el cálculo existente de stock siga siendo autoritativo.
 */
function inventoryBook_() { return SpreadsheetApp.openById(HMS_CONFIG.INVENTORY_SPREADSHEET_ID); }

function inventoryHeaders_(sheet,row,expected) {
  if(!sheet) throw new Error('No existe una pestaña de Inventory.');
  var actual=sheet.getRange(row,1,1,expected.length).getDisplayValues()[0];
  expected.forEach(function(value,index){
    if(String(actual[index]||'').trim()!==value)
      throw new Error(sheet.getName()+': estructura inesperada en columna '+(index+1));
  });
}

function inventoryNumber_(value) {
  if(value===null || value===undefined || value==='' || value==='VACIO') return null;
  if(typeof value==='number') return isFinite(value)?value:null;
  var cleaned=String(value).replace(/\$/g,'').replace(/,/g,'').trim();
  var n=Number(cleaned);
  return cleaned && isFinite(n) ? n : null;
}

function getInventory_(refresh) {
  var cache=CacheService.getScriptCache();
  var cached=!refresh&&cache.get(HMS_CONFIG.INVENTORY_CACHE_KEY);
  if(cached)return JSON.parse(cached);
  var ss=inventoryBook_();
  var stock=ss.getSheetByName('Inventario');
  var master=ss.getSheetByName('Master products');
  inventoryHeaders_(stock,2,['PRODUCTO','CATEGORIA','UNIDAD','STOCK','PAR_LEVEL','ULT_ACT','ULT_PRECIO']);
  inventoryHeaders_(master,2,['PRODUCTO','CATEGORIA','UNIDAD','NIVEL','ALIAS','STATUS','ACEPTAR?','NOTAS']);

  // A:C siguen Master products; D:G son fórmulas del propio inventario.
  var products=master.getRange(3,1,Math.max(1,master.getLastRow()-2),8).getValues();
  var active={};
  products.forEach(function(row){
    var name=String(row[0]||'').trim();
    if(name && String(row[5]||'').toLowerCase()==='active') active[name]=true;
  });
  var rows=stock.getRange(3,1,Math.max(1,stock.getLastRow()-2),7).getValues();
  var items=rows.filter(function(row){return !!active[String(row[0]||'').trim()];})
    .map(function(row){
      var name=String(row[0]).trim(), current=inventoryNumber_(row[3]);
      var par=inventoryNumber_(row[4]), price=inventoryNumber_(row[6]);
      var date=row[5] instanceof Date ? dateKey_(row[5]) :
        String(row[5]||'').trim();
      return {
        id:name, name:name,category:String(row[1]||'Suministros'),
        unit:String(row[2]||''), stock:current===null?0:current,
        parLevel:par===null?0:par,
        suggestedPurchase:current!==null&&par!==null?Math.max(0,Math.ceil(par-current)):0,
        lastUpdated:date==='VACIO'?'Sin registro':date,
        lastPrice:price===null?0:price,
        stockKnown:current!==null, priceKnown:price!==null, parKnown:par!==null
      };
    });

  var maintenance=ss.getSheetByName('Maintenance Items');
  var maintenanceItems=[];
  if(maintenance) {
    inventoryHeaders_(maintenance,2,['area','item','interval_days','description','notes']);
    var m=maintenance.getRange(3,1,Math.max(1,maintenance.getLastRow()-2),5).getValues();
    maintenanceItems=m.filter(function(row){return row[0]&&row[1];}).map(function(row){
      return {area:String(row[0]),item:String(row[1]),
        intervalDays:inventoryNumber_(row[2])||0,description:String(row[3]||'')};
    });
  }
  var payload={items:items,maintenanceItems:maintenanceItems,
    purchaseRequests:[], purchaseRequestsAvailable:false,
    generatedAt:new Date().toISOString()};
  var json=JSON.stringify(payload);
  if(json.length<90000)cache.put(HMS_CONFIG.INVENTORY_CACHE_KEY,json,HMS_CONFIG.INVENTORY_CACHE_SECONDS);
  return payload;
}

function inventoryClearCache_() {
  CacheService.getScriptCache().remove(HMS_CONFIG.INVENTORY_CACHE_KEY);
}

/**
 * Conteo físico: deltas compensatorios contra el stock calculado.
 * Los tipos "compras"/"uso" son los únicos reconocidos por Inventario!D.
 * NOTA: un ajuste por "uso" puede alterar Par Calc, porque éste suma todo
 * uso reciente. Queda registrado con nota identificable para conciliación.
 */
function saveInventoryCount_(request) {
  var changes=request.changes, id=String(request.countId||'').trim();
  if(!/^HMS-COUNT-[a-zA-Z0-9-]{8,}$/.test(id) ||
      !Array.isArray(changes)||!changes.length||changes.length>100)
    throw new Error('Conteo no válido.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var ss=inventoryBook_(), stock=ss.getSheetByName('Inventario'),
      tx=ss.getSheetByName('Transacciones');
    inventoryHeaders_(stock,2,['PRODUCTO','CATEGORIA','UNIDAD','STOCK','PAR_LEVEL','ULT_ACT','ULT_PRECIO']);
    inventoryHeaders_(tx,2,['FECHA','TIPO','PRODUCTO','CANTIDAD','UNIDAD','PRECIO_UNITARIO','COSTO_TOTAL','PROVEEDOR','DONDE','NOTAS']);
    var existingRows=Math.max(0,tx.getLastRow()-2);
    if(existingRows) {
      var notes=tx.getRange(3,10,existingRows,1).getValues();
      if(notes.some(function(row){return String(row[0]||'').indexOf('ID:'+id)!==-1}))
        throw new Error('Conteo ya registrado: refresca antes de reintentar para verificar cantidades.');
    }
    var stockRows=stock.getRange(3,1,Math.max(1,stock.getLastRow()-2),7).getValues();
    var catalog={};
    stockRows.forEach(function(r) {var name=String(r[0]||'').trim();if(name)catalog[name]=r;});
    var updates=[],used={};
    changes.forEach(function(item){
      var name=String(item.product||'').trim(),wanted=Number(item.counted);
      if(!catalog[name]||used[name]||!isFinite(wanted)||wanted<0||wanted>1000000)
        throw new Error('Producto o cantidad inválidos: '+name);
      used[name]=true;
      var old=inventoryNumber_(catalog[name][3]);
      if(old===null) throw new Error('Stock no registrado: '+name);
      var delta=Math.round((wanted-old)*100)/100;
      if(!delta)return;
      updates.push([cashDate_(todayKey_()),delta>0?'compras':'uso',
        name,Math.abs(delta),'','',0,'Ajuste de conteo HMS','Inventario',
        'AJUSTE CONTEO | ID:'+id+' | antes:'+old+' | contado:'+wanted]);
    });
    if(!updates.length)return {countId:id,changed:0};
    var last=tx.getLastRow(),target=Math.max(3,last+1);
    // Stock/Par Calc usan Transacciones filas 3:1000. Nunca escribir fuera.
    if(target+updates.length-1>1000)throw new Error('Transacciones llega al límite de las fórmulas (fila 1000).');
    try {
      // No escribir E/F: son fórmulas de unidad y precio por transacción.
      updates.forEach(function(row,index){
        var n=target+index;
        tx.getRange(n,1,1,4).setValues([row.slice(0,4)]);
        tx.getRange(n,7,1,4).setValues([row.slice(6,10)]);
      });
      SpreadsheetApp.flush();
    }catch(error) {
      try {
        tx.getRange(target,1,updates.length,4).clearContent();
        tx.getRange(target,7,updates.length,4).clearContent();
      }catch(rollback){console.error('CONCILIACION INVENTARIO '+id+': '+rollback);}
      throw error;
    }
    inventoryClearCache_();
    return {countId:id,changed:updates.length};
  }finally{lock.releaseLock();}
}

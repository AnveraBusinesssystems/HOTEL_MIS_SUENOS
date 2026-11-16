/**
 * Web App entry point. GET intentionally exposes health only, never hotel data.
 */
function doGet(event) {
  // Cross-origin GET for the three non-personal aggregate reports only.
  // The browser uses a script tag because Apps Script ContentService redirects
  // cross-origin fetch responses. JSONP is public: NEVER add guest, payroll,
  // cash transactions, personnel or mutation routes to this allowlist.
  var params = event && event.parameter ? event.parameter : {};
  var action = String(params.action || '');
  var callback = String(params.callback || '');
  if (!action) {
    return jsonResponse_({
      ok: true,
      data: { service: 'HMS API', status: 'ready', version: '1.1.0' }
    });
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,90}$/.test(callback)) {
    return jsonResponse_({ok:false,error:{code:'BAD_CALLBACK',message:'Callback no válido.'}});
  }
  if (['summary.get', 'indicators.get', 'rms.get'].indexOf(action) === -1) {
    return staffJsonp_(callback, {ok:false,error:{code:'FORBIDDEN',message:'Solo reportes agregados permitidos.'}});
  }
  try {
    var result;
    switch (action) {
      case 'summary.get': result = getSummary_(); break;
      case 'indicators.get': result = getIndicators_(params.includeMonthly === 'true'); break;
      case 'rms.get': result = getRms_(params.refresh === 'true'); break;
    }
    return staffJsonp_(callback, {ok:true,data:result});
  } catch (error) {
    console.error('Aggregate API '+action+': '+(error && error.stack ? error.stack : error));
    return staffJsonp_(callback, {ok:false,error:{code:'READ_ERROR',message:'Error al leer '+action+'; revisa las ejecuciones de Apps Script.'}});
  }
}

function staffJsonp_(callback, payload) {
  return ContentService.createTextOutput(callback+'('+JSON.stringify(payload)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * One POST from the frontend maps to one module action.
 * The frontend sends text/plain to avoid an additional CORS preflight request.
 */
function doPost(event) {
  try {
    var request = parseRequest_(event);

    // TEMPORARY SECURITY GATE: the legacy POST routes have no globally
    // authenticated user. Do not expose private records or writes merely
    // because the Apps Script Web App URL is public.
    if (['summary.get','indicators.get','rms.get'].indexOf(request.action) < 0) {
      return jsonResponse_({ok:false,error:{
        code:'AUTH_REQUIRED',
        message:'Se requiere autenticación de servidor para esta acción.'
      }});
    }

    switch (request.action) {
      case 'staff.get':
        return jsonResponse_({ ok: true, data: getStaff_(request) });
      case 'staff.employee.save':
        return jsonResponse_({ ok: true, data: saveStaffEmployee_(request) });
      case 'staff.employee.status':
        return jsonResponse_({ ok: true, data: setStaffStatus_(request) });
      case 'staff.schedule.save':
        return jsonResponse_({ ok: true, data: saveStaffSchedules_(request) });
      case 'staff.schedule.delete':
        return jsonResponse_({ ok: true, data: deleteStaffSchedule_(request) });
      case 'staff.request.create':
        return jsonResponse_({ ok: true, data: createStaffRequest_(request) });
      case 'staff.request.review':
        return jsonResponse_({ ok: true, data: reviewStaffRequest_(request) });
      case 'staff.attendance.punch':
        return jsonResponse_({ ok: true, data: punchStaff_(request) });
      case 'inventory.purchase':
        return jsonResponse_({ok:true,data:recordInventoryPurchase_(request)});
      case 'inventory.get':
        return jsonResponse_({ok:true,data:getInventory_(request.refresh===true)});
      case 'inventory.count':
        return jsonResponse_({ok:true,data:saveInventoryCount_(request)});
      case 'summary.get':
        return jsonResponse_({ ok: true, data: getSummary_() });
      case 'indicators.get':
        return jsonResponse_({ ok: true, data: getIndicators_(request.includeMonthly === true) });
      case 'rms.get':
        return jsonResponse_({ ok: true, data: getRms_(request.refresh === true) });
      case 'tour.payment':
        return jsonResponse_({ ok: true, data: recordTourPayment_(request) });
      case 'tour.update':
        return jsonResponse_({ ok: true, data: updateTourStatus_(request) });
      case 'cash.get':
        return jsonResponse_({ ok: true, data: getCash_(request.refresh === true) });
      case 'cash.movement.create':
        return jsonResponse_({ ok: true, data: registerCashMovement_(request) });
      case 'cash.movement.annul':
        return jsonResponse_({ ok: true, data: annulCashMovement_(request) });
      case 'cash.day.close':
        return jsonResponse_({ ok: true, data: closeCashDay_(request) });
      case 'cash.day.save':
        return jsonResponse_({ ok: true, data: saveCashDay_(request) });
      case 'operation.get':
        return jsonResponse_({ ok: true, data: getOperation_(request.refresh === true) });
      case 'operation.event':
        return jsonResponse_({ ok: true, data: recordOperationEvent_(request) });
      case 'reservations.get':
        return jsonResponse_({ ok: true, data: getReservations_(request.refresh === true) });
      case 'reservations.payment':
        return jsonResponse_({ ok: true, data: recordReservationPayment_(request) });
      case 'reservations.update':
        return jsonResponse_({ ok: true, data: updateReservation_(request) });
      default:
        return jsonResponse_({
          ok: false,
          error: { code: 'UNKNOWN_ACTION', message: 'Acción no reconocida.' }
        });
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'No fue posible completar la solicitud.' }
    });
  }
}

/**
 * Web App entry point. GET intentionally exposes health only, never hotel data.
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    data: { service: 'HMS API', status: 'ready', version: '1.0.0' }
  });
}

/**
 * One POST from the frontend maps to one module action.
 * The frontend sends text/plain to avoid an additional CORS preflight request.
 */
function doPost(event) {
  try {
    var request = parseRequest_(event);

    switch (request.action) {
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

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
      case 'summary.get':
        return jsonResponse_({ ok: true, data: getSummary_() });
      case 'indicators.get':
        return jsonResponse_({ ok: true, data: getIndicators_(request.includeMonthly === true) });
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

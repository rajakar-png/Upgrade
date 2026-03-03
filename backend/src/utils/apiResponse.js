export function ok(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  })
}

export function fail(res, message, statusCode = 400, data = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    data
  })
}

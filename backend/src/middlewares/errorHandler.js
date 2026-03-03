export function errorHandler(err, req, res, next) {
  if (err.name === "ZodError") {
    return res.status(400).json({ success: false, message: "Validation failed", data: { details: err.errors } })
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message, data: {} })
  }

  // Log full error server-side but never expose stack or internals to clients
  console.error(`[ERROR] Unhandled ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ success: false, message: "Internal server error", data: {} })
}

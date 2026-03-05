export function errorHandler(err, req, res, next) {
  if (err.name === "ZodError") {
    return res.status(400).json({ success: false, error: "Validation failed", message: "Validation failed", data: { details: err.errors } })
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, error: err.message, message: err.message, data: {} })
  }

  // Log full error server-side but never expose stack or internals to clients
  console.error(`[ERROR] Unhandled ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ success: false, error: "Internal server error", message: "Internal server error", data: {} })
}

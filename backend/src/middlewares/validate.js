export function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse({ body: req.body, params: req.params, query: req.query })
      next()
    } catch (error) {
      console.error("[VALIDATE] Validation failed:", {
        path: req.path,
        errors: error.issues || error.errors
      })
      next(error)
    }
  }
}

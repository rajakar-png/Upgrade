export function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse({ body: req.body, params: req.params, query: req.query })
      next()
    } catch (error) {
      const issues = error.issues || error.errors || []
      console.error("[VALIDATE] Validation failed:", {
        path: req.path,
        errors: issues.map(e => ({ path: e.path?.join("."), code: e.code, message: e.message }))
      })
      next(error)
    }
  }
}

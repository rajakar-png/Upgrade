export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({ body: req.body, params: req.params, query: req.query })
      if (parsed?.body !== undefined) req.body = parsed.body
      if (parsed?.params !== undefined) req.params = parsed.params
      if (parsed?.query !== undefined) req.query = parsed.query
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

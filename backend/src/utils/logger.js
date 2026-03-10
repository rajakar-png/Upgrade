function write(level, message, meta = {}) {
  const record = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  }

  if (level === "error") {
    console.error(JSON.stringify(record))
    return
  }

  if (level === "warn") {
    console.warn(JSON.stringify(record))
    return
  }

  console.log(JSON.stringify(record))
}

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
  debug: (message, meta) => write("debug", message, meta)
}

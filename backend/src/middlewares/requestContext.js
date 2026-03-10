import crypto from "crypto"

const metrics = {
  requestsTotal: 0,
  lastMinuteRequests: []
}

function prune(nowMs) {
  const cutoff = nowMs - 60_000
  while (metrics.lastMinuteRequests.length > 0 && metrics.lastMinuteRequests[0] < cutoff) {
    metrics.lastMinuteRequests.shift()
  }
}

export function requestContext(req, res, next) {
  const incomingRequestId = req.headers["x-request-id"]
  const requestId = typeof incomingRequestId === "string" && incomingRequestId.trim()
    ? incomingRequestId.trim().slice(0, 64)
    : crypto.randomUUID().slice(0, 12)

  req.requestId = requestId
  req.requestStartMs = Date.now()
  res.setHeader("x-request-id", requestId)

  const now = Date.now()
  metrics.requestsTotal += 1
  metrics.lastMinuteRequests.push(now)
  prune(now)

  next()
}

export function getRequestMetrics() {
  const now = Date.now()
  prune(now)
  return {
    requestsTotal: metrics.requestsTotal,
    requestsPerMinute: metrics.lastMinuteRequests.length
  }
}

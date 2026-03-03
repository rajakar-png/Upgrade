export function getDurationDays(durationType, durationDays) {
  if (durationType === "weekly") {
    return 7
  }

  if (durationType === "monthly") {
    return 30
  }

  if (durationType === "lifetime") {
    return 365000 // ~1000 years
  }

  // For "custom", "days", or any other type, use the provided durationDays
  return durationDays
}

export function addDays(isoDate, days) {
  const base = isoDate ? new Date(isoDate) : new Date()
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  return next.toISOString()
}

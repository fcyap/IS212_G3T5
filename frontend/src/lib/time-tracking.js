export const EMPTY_TIME_SUMMARY = { total_hours: 0, per_assignee: [] }

export function normalizeTimeSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return EMPTY_TIME_SUMMARY
  }

  const total = Number(summary.total_hours)
  const perAssignee = Array.isArray(summary.per_assignee)
    ? summary.per_assignee
        .map((entry) => {
          const userId = Number(entry?.user_id ?? entry?.id)
          const hours = Number(entry?.hours)
          if (!Number.isFinite(userId) || userId <= 0) return null
          return {
            user_id: Math.trunc(userId),
            hours: Number.isFinite(hours) && hours >= 0 ? hours : 0
          }
        })
        .filter(Boolean)
    : []

  return {
    total_hours: Number.isFinite(total) && total >= 0 ? total : 0,
    per_assignee: perAssignee
  }
}

export function extractUserHours(summary, userId) {
  if (!Number.isFinite(Number(userId))) return ""
  const normalized = normalizeTimeSummary(summary)
  const target = normalized.per_assignee.find(
    (entry) => entry.user_id === Math.trunc(Number(userId))
  )
  if (!target) return ""
  const hours = Number(target.hours ?? target.hours_spent)
  return Number.isFinite(hours) && hours >= 0 ? hours.toString() : ""
}

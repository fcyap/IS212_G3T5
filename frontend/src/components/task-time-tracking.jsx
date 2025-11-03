"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Clock } from "lucide-react"

const toNumber = (val) => {
  const num = Number(val)
  return Number.isFinite(num) ? num : 0
}

const formatHours = (value) => {
  const num = toNumber(value)
  return num.toFixed(num % 1 === 0 ? 0 : 2)
}

/**
 * Shared UI block for capturing per-assignee hours and surfacing totals.
 * @param {Object} props
 * @param {number|string} props.value - Mutable hours entry for the current user.
 * @param {(next: string) => void} props.onChange - Change handler for the editable field.
 * @param {boolean} props.canEdit - Whether the current user may edit their hours.
 * @param {number} props.totalHours - Aggregate hours across all assignees.
 * @param {Array} props.perAssignee - Summary objects `{ user_id, hours }`.
 * @param {Array} props.assignees - Task assignees with id/name information.
 * @param {React.ReactNode} props.helperText - Optional helper text below the personal field.
 * @param {React.ReactNode} props.totalLabel - Optional label override for the total field.
 */
export function TaskTimeTracking({
  value,
  onChange,
  canEdit = false,
  totalHours = 0,
  perAssignee = [],
  assignees = [],
  helperText = null,
  totalLabel = "Total hours (all assignees)"
}) {
  const assigneeNames = useMemo(() => {
    const map = new Map()
    assignees.forEach((entry) => {
      const rawId = entry?.id ?? entry?.user_id ?? entry?.userId
      const numericId = Number(rawId)
      if (!Number.isFinite(numericId)) return
      const label = entry?.name ?? entry?.email ?? `User ${numericId}`
      map.set(numericId, label)
    })
    return map
  }, [assignees])

  const breakdown = useMemo(() => {
    return perAssignee
      .map((entry) => {
        const numericId = Number(entry?.user_id ?? entry?.id)
        if (!Number.isFinite(numericId)) return null
        const hours = toNumber(entry?.hours ?? entry?.hours_spent)
        return {
          userId: numericId,
          hours,
          label: assigneeNames.get(numericId) ?? `User ${numericId}`
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [perAssignee, assigneeNames])

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Your hours spent</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={0.25}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            disabled={!canEdit}
            className="bg-transparent"
            style={{ color: 'rgb(var(--foreground))', borderColor: 'rgb(var(--border))' }}
            placeholder="0"
            inputMode="decimal"
          />
          <Clock className="w-4 h-4" style={{ color: 'rgb(var(--muted-foreground))' }} aria-hidden="true" />
        </div>
        <p className="mt-1 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {canEdit
            ? helperText ?? "Enter the hours you've spent so far. Decimals are allowed."
            : "Only assigned members can update their own hours."}
        </p>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>{totalLabel}</label>
        <Input
          value={formatHours(totalHours)}
          readOnly
          style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))', borderColor: 'rgb(var(--border))' }}
        />
      </div>

      {breakdown.length > 0 && (
        <div className="rounded-md border p-3" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}>
          <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>Breakdown by assignee</p>
          <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--foreground))' }}>
            {breakdown.map((entry) => (
              <li key={entry.userId} className="flex justify-between">
                <span className="truncate">{entry.label}</span>
                <span className="tabular-nums" style={{ color: 'rgb(var(--muted-foreground))' }}>{formatHours(entry.hours)}h</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

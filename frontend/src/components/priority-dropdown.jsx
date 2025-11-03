"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRIORITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const priorityChipClasses = {
  1: "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 font-medium",
  2: "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 font-medium",
  3: "bg-teal-100 dark:bg-teal-600 text-teal-800 dark:text-white border border-teal-300 dark:border-teal-600 font-medium",
  4: "bg-teal-100 dark:bg-teal-600 text-teal-800 dark:text-white border border-teal-300 dark:border-teal-600 font-medium",
  5: "bg-amber-100 dark:bg-amber-600 text-amber-800 dark:text-white border border-amber-300 dark:border-amber-600 font-medium",
  6: "bg-amber-100 dark:bg-amber-700 text-amber-900 dark:text-white border border-amber-300 dark:border-amber-700 font-medium",
  7: "bg-orange-100 dark:bg-orange-600 text-orange-900 dark:text-white border border-orange-300 dark:border-orange-600 font-medium",
  8: "bg-red-100 dark:bg-red-600 text-red-900 dark:text-white border border-red-300 dark:border-red-600 font-medium",
  9: "bg-fuchsia-100 dark:bg-fuchsia-600 text-fuchsia-900 dark:text-white border border-fuchsia-300 dark:border-fuchsia-600 font-medium",
  10: "bg-purple-100 dark:bg-purple-600 text-purple-900 dark:text-white border border-purple-300 dark:border-purple-600 font-medium",
};

/**
 * Reusable Priority Dropdown Component
 * @param {number} value - The current priority value (1-10)
 * @param {function} onValueChange - Callback when priority changes
 * @param {boolean} disabled - Whether the dropdown is disabled
 * @param {string} triggerClassName - Additional classes for the trigger
 * @param {object} triggerStyle - Inline styles for the trigger
 * @param {string} contentClassName - Additional classes for the content
 */
export function PriorityDropdown({
  value,
  onValueChange,
  disabled = false,
  triggerClassName = "bg-transparent",
  triggerStyle = {},
  contentClassName = "bg-white"
}) {
  return (
    <Select
      value={value?.toString()}
      onValueChange={(val) => onValueChange(Number(val))}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName} style={triggerStyle}>
        <SelectValue placeholder="Select priority" />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority} value={priority.toString()}>
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[priority]}`}>
              {priority}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

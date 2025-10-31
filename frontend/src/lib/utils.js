import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Get priority metadata for a given priority value (1-10 scale)
 * @param {number|string} priority - Priority value (1-10)
 * @returns {{value: number, label: string, badgeClass: string, textClass: string}}
 */
export function getPriorityMeta(priority) {
  const p = Number(priority);
  if (!Number.isInteger(p) || p < 1 || p > 10) {
    console.warn(`Unexpected priority value: "${priority}". Defaulting to 5.`);
    return { value: 5, label: '5', badgeClass: 'bg-amber-200 text-amber-900', textClass: 'text-amber-400' };
  }

  // Color mapping for 1-10 scale: 1-3 low (green), 4-6 medium (yellow), 7-10 high (red)
  const badgeClass =
    p >= 9 ? 'bg-fuchsia-400 text-fuchsia-950' :
    p >= 7 ? 'bg-red-300 text-red-950' :
    p >= 4 ? 'bg-amber-300 text-amber-950' :
    'bg-teal-200 text-teal-900';

  const textClass =
    p >= 9 ? 'text-fuchsia-400' :
    p >= 7 ? 'text-red-400' :
    p >= 4 ? 'text-yellow-400' :
    'text-green-400';

  return { value: p, label: p.toString(), badgeClass, textClass };
}

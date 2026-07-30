import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'unknown';
  const [y, m, d] = iso.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m) - 1]} ${y}`;
}

/** Confidence band label for a 0–100 score. See METHODOLOGY.md §17. */
export function confidenceBand(score: number): { label: string; tone: string } {
  if (score >= 90) return { label: 'Very high', tone: 'bg-emerald-600' };
  if (score >= 75) return { label: 'High', tone: 'bg-emerald-500' };
  if (score >= 60) return { label: 'Moderate', tone: 'bg-amber-500' };
  if (score >= 40) return { label: 'Low', tone: 'bg-orange-500' };
  return { label: 'Unconfirmed', tone: 'bg-zinc-500' };
}

/**
 * Marker radius from the maximum damage score.
 * Size encodes severity; colour encodes industry; outline encodes status.
 */
export function markerRadius(maxDamageScore: number, incidentCount: number): number {
  const base = 6 + maxDamageScore * 2.4;
  return Math.min(base + Math.min(incidentCount - 1, 5) * 0.9, 26);
}

export const STATUS_OUTLINE: Record<string, string> = {
  normal_operations: '#3fb950',
  operations_reduced: '#d29922',
  partially_restored: '#58a6ff',
  fully_restored: '#3fb950',
  temporarily_suspended: '#f85149',
  long_term_shutdown: '#a40e26',
  destroyed: '#000000',
  unknown: '#8b949e',
};

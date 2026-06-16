The task asks me to generate a new `lib/utils.ts` with the specified functions. Since this appears to be a request to output file content (not write to the existing file), I'll return the TypeScript content directly.

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type { ClassValue }

// Format relative time
export function timeAgo(date: string | Date): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR })
}

// Format absolute date
export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return format(parsed, pattern, { locale: ptBR })
}

// Get user initials from name or email
export function getUserInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return '?'
  const trimmed = nameOrEmail.trim()

  // If it looks like an email, use the local part before @
  const isEmail = trimmed.includes('@')
  const base = isEmail ? trimmed.split('@')[0] : trimmed

  const parts = base.split(/[\s._\-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Get deterministic color for user (for avatar backgrounds)
export function getUserColor(userId: string): string {
  const COLORS = [
    '#4F46E5', // indigo
    '#7C3AED', // violet
    '#DB2777', // pink
    '#DC2626', // red
    '#D97706', // amber
    '#059669', // emerald
    '#0284C7', // sky
    '#0891B2', // cyan
    '#65A30D', // lime
    '#9333EA', // purple
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

// Generate a comment pin label (sequential number)
export function getPinLabel(index: number): string {
  return String(index + 1)
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trimEnd() + '…'
}

// Parse position from percentage to pixel
export function percentageToPixel(percentage: number, dimension: number): number {
  return (percentage / 100) * dimension
}

// Build Supabase storage URL
export function getStorageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`
}

// Status color mapping
export function getStatusColor(status: 'open' | 'resolved' | 'reopened'): string {
  switch (status) {
    case 'open':
      return '#3B82F6' // blue-500
    case 'resolved':
      return '#22C55E' // green-500
    case 'reopened':
      return '#F59E0B' // amber-500
    default:
      return '#6B7280' // gray-500
  }
}

// Priority color mapping
export function getPriorityColor(priority: 'low' | 'normal' | 'high' | 'critical'): string {
  switch (priority) {
    case 'low':
      return '#6B7280' // gray-500
    case 'normal':
      return '#3B82F6' // blue-500
    case 'high':
      return '#F59E0B' // amber-500
    case 'critical':
      return '#EF4444' // red-500
    default:
      return '#6B7280'
  }
}

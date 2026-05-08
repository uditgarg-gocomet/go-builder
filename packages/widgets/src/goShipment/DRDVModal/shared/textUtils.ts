// ── Small text helpers ──────────────────────────────────────────────────────

export function titleCase(snakeOrKebab: string): string {
  return snakeOrKebab
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const MAX_INLINE_LEN = 28

export function shouldTruncate(value: string): boolean {
  return value.length > MAX_INLINE_LEN
}

export function truncateValue(value: string): string {
  return shouldTruncate(value) ? `${value.slice(0, MAX_INLINE_LEN)}…` : value
}

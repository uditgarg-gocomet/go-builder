import React from 'react'
import { z } from 'zod'
import { DayPicker, type DateRange } from 'react-day-picker'
import { cn } from '../../lib/utils.js'

export const DatePickerPropsSchema = z.object({
  label: z.string().optional(),
  mode: z.enum(['single', 'range']).default('single'),
  placeholder: z.string().default('Pick a date'),
  error: z.string().optional(),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  className: z.string().optional(),
})

export type DatePickerProps = z.infer<typeof DatePickerPropsSchema> & {
  value?: Date | DateRange
  onChange?: (value: Date | DateRange | undefined) => void
  style?: React.CSSProperties
}

export const datePickerManifest = {
  displayName: 'Date Picker',
  category: 'Input',
  description: 'Date selection — single date or date range using react-day-picker',
  icon: 'calendar',
  tags: ['datepicker', 'date', 'calendar', 'input', 'form'],
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatValue(value: DatePickerProps['value'], mode: string): string {
  if (!value) return ''
  if (mode === 'range' && typeof value === 'object' && 'from' in value) {
    const range = value as DateRange
    if (range.from && range.to) return `${formatDate(range.from)} – ${formatDate(range.to)}`
    if (range.from) return `${formatDate(range.from)} –`
    return ''
  }
  if (value instanceof Date) return formatDate(value)
  return ''
}

export function DatePicker({ label, mode = 'single', placeholder = 'Pick a date', value, error, disabled = false, required = false, className, style, onChange }: DatePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayValue = formatValue(value, mode)

  return (
    <div ref={ref} style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          error ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={displayValue ? 'text-foreground' : 'text-muted-foreground'}>{displayValue || placeholder}</span>
        <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-md border border-border bg-popover shadow-md">
          {mode === 'range' ? (
            <DayPicker
              mode="range"
              selected={value instanceof Date ? undefined : value as DateRange | undefined}
              onSelect={range => onChange?.(range)}
              className="p-3"
            />
          ) : (
            <DayPicker
              mode="single"
              selected={value instanceof Date ? value : undefined}
              onSelect={date => { onChange?.(date); setOpen(false) }}
              className="p-3"
            />
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

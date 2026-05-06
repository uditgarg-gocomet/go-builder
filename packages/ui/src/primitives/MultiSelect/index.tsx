import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const MultiSelectPropsSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().default('Select…'),
  options: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  value: z.array(z.string()).default([]),
  error: z.string().optional(),
  disabled: z.boolean().default(false),
  searchable: z.boolean().default(true),
  className: z.string().optional(),
})

export type MultiSelectProps = z.infer<typeof MultiSelectPropsSchema> & {
  onChange?: (values: string[]) => void
  style?: React.CSSProperties
}

export const multiSelectManifest = {
  displayName: 'Multi Select',
  category: 'Input',
  description: 'Multi-value select with tag display and search',
  icon: 'list-checks',
  tags: ['multiselect', 'multi', 'input', 'form', 'tags'],
}

export function MultiSelect({ label, placeholder = 'Select…', options, value = [], error, disabled = false, searchable = true, className, style, onChange }: MultiSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const toggle = (v: string): void => {
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v]
    onChange?.(next)
  }

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selectedOptions = options.filter(o => value.includes(o.value))

  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <div
          onClick={() => !disabled && setOpen(o => !o)}
          className={cn(
            'flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 cursor-pointer',
            error ? 'border-destructive' : 'border-input',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {selectedOptions.map(o => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
              {o.label}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle(o.value) }}
                className="hover:opacity-70"
              >×</button>
            </span>
          ))}
          {selectedOptions.length === 0 && <span className="text-sm text-muted-foreground">{placeholder}</span>}
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {searchable && (
              <div className="p-2 border-b border-border">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full text-sm outline-none bg-transparent"
                  onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No options</p>}
              {filtered.map(o => (
                <div
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={cn('flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent', value.includes(o.value) && 'font-medium')}
                >
                  <span className={cn('h-4 w-4 rounded border border-input flex items-center justify-center', value.includes(o.value) && 'bg-primary border-primary')}>
                    {value.includes(o.value) && <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" /></svg>}
                  </span>
                  {o.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

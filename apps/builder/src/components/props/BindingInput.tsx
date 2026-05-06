'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useBindingSuggestions } from '@/hooks/useBindingSuggestions'

interface BindingInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BindingInput({ value, onChange, placeholder = '{{datasource.alias.field}}' }: BindingInputProps): React.ReactElement {
  const suggestions = useBindingSuggestions()
  const [showDropdown, setShowDropdown] = useState(false)
  const [filter, setFilter] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filtered = suggestions.filter(s =>
    filter === '' || s.path.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 20)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const v = e.target.value
    onChange(v)
    const lastBrace = v.lastIndexOf('{{')
    const lastClose = v.lastIndexOf('}}')
    if (lastBrace > lastClose) {
      const query = v.slice(lastBrace + 2)
      setFilter(query)
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  const handleSelect = (path: string): void => {
    const lastBrace = value.lastIndexOf('{{')
    const before = value.slice(0, lastBrace)
    onChange(`${before}{{${path}}}`)
    setShowDropdown(false)
    setFilter('')
    textareaRef.current?.focus()
  }

  useEffect(() => {
    const close = (): void => setShowDropdown(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onFocus={() => value.includes('{{') && !value.includes('}}') && setShowDropdown(true)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        onMouseDown={e => e.stopPropagation()}
      />
      {showDropdown && filtered.length > 0 && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          onMouseDown={e => e.stopPropagation()}
        >
          {filtered.map(s => (
            <button
              key={s.path}
              type="button"
              onMouseDown={() => handleSelect(s.path)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
            >
              <span className="rounded bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">{s.category}</span>
              <span className="truncate font-mono text-xs text-foreground">{s.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

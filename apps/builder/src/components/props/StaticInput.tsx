'use client'

import React, { useState } from 'react'
import { z } from 'zod'

interface StaticInputProps {
  zodType: z.ZodTypeAny
  value: unknown
  onChange: (value: unknown) => void
  propKey: string
}

export function StaticInput({ zodType, value, onChange, propKey }: StaticInputProps): React.ReactElement {
  return <StaticInputInner zodType={zodType} value={value} onChange={onChange} propKey={propKey} depth={0} />
}

interface StaticInputInnerProps extends StaticInputProps {
  depth: number
}

function StaticInputInner({ zodType, value, onChange, propKey, depth }: StaticInputInnerProps): React.ReactElement {
  const inputClass = 'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring'

  // Unwrap optional/nullable
  if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
    return <StaticInputInner zodType={zodType.unwrap()} value={value} onChange={onChange} propKey={propKey} depth={depth} />
  }

  if (zodType instanceof z.ZodDefault) {
    return <StaticInputInner zodType={zodType._def.innerType as z.ZodTypeAny} value={value} onChange={onChange} propKey={propKey} depth={depth} />
  }

  if (zodType instanceof z.ZodString) {
    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
        placeholder={propKey}
      />
    )
  }

  if (zodType instanceof z.ZodNumber) {
    return (
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className={inputClass}
      />
    )
  }

  if (zodType instanceof z.ZodBoolean) {
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 rounded border border-input accent-primary"
        />
        <span className="text-sm text-foreground">{value ? 'true' : 'false'}</span>
      </label>
    )
  }

  if (zodType instanceof z.ZodEnum) {
    const options = zodType.options as string[]
    return (
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  if (zodType instanceof z.ZodArray) {
    return <ArrayEditor value={value} onChange={onChange} itemType={zodType.element} propKey={propKey} />
  }

  if (zodType instanceof z.ZodObject) {
    return <JsonEditor value={value} onChange={onChange} />
  }

  // Fallback: JSON editor
  return <JsonEditor value={value} onChange={onChange} />
}

function JsonEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }): React.ReactElement {
  const [text, setText] = useState(() => {
    try { return JSON.stringify(value, null, 2) } catch { return '' }
  })
  const [error, setError] = useState(false)

  const handleChange = (v: string): void => {
    setText(v)
    try {
      onChange(JSON.parse(v))
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <textarea
      value={text}
      onChange={e => handleChange(e.target.value)}
      rows={4}
      className={`w-full resize-y rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring ${error ? 'border-destructive' : 'border-input'}`}
    />
  )
}

function ArrayEditor({
  value,
  onChange,
  itemType,
  propKey,
}: {
  value: unknown
  onChange: (v: unknown) => void
  itemType: z.ZodTypeAny
  propKey: string
}): React.ReactElement {
  const arr = Array.isArray(value) ? value : []

  const updateItem = (i: number, v: unknown): void => {
    const next = [...arr]
    next[i] = v
    onChange(next)
  }

  const addItem = (): void => onChange([...arr, undefined])
  const removeItem = (i: number): void => onChange(arr.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-1.5">
      {arr.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="flex-1">
            <StaticInputInner zodType={itemType} value={item} onChange={v => updateItem(i, v)} propKey={`${propKey}[${i}]`} depth={1} />
          </div>
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="mt-1 rounded p-0.5 text-muted-foreground hover:text-destructive"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="rounded-md border border-dashed border-border py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
      >
        + Add item
      </button>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { ThemeOverride } from '@portal/core'

const GOOGLE_FONTS = ['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Lato', 'Nunito', 'DM Sans']

const TOKEN_FIELDS: { key: string; label: string; defaultValue: string }[] = [
  { key: '--brand-primary', label: 'Primary', defaultValue: '#6366f1' },
  { key: '--brand-secondary', label: 'Secondary', defaultValue: '#8b5cf6' },
  { key: '--brand-surface', label: 'Surface', defaultValue: '#ffffff' },
  { key: '--brand-text', label: 'Text', defaultValue: '#111827' },
]

interface ThemePanelProps {
  appId: string
}

export function ThemePanel({ appId }: ThemePanelProps): React.ReactElement {
  const theme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const tokens = theme.tokens ?? {}
  const fonts = theme.fonts ?? []

  const setToken = (key: string, value: string): void => {
    setTheme({ ...theme, tokens: { ...tokens, [key]: value } })
  }

  const setFont = (font: string): void => {
    setTheme({ ...theme, fonts: font ? [font] : [] })
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await fetch(`/api/apps/${appId}/theme`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const previewStyle = TOKEN_FIELDS.reduce<Record<string, string>>((acc, f) => {
    acc[f.key] = tokens[f.key] ?? f.defaultValue
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Theme</h3>

      {/* Color tokens */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Brand Colors</p>
        {TOKEN_FIELDS.map(({ key, label, defaultValue }) => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={tokens[key] ?? defaultValue}
              onChange={e => setToken(key, e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input"
            />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">{label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{key}</p>
            </div>
            <input
              type="text"
              value={tokens[key] ?? defaultValue}
              onChange={e => setToken(key, e.target.value)}
              className="w-24 rounded border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ))}
      </div>

      {/* Font */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Font Family</p>
        <select
          value={fonts[0] ?? ''}
          onChange={e => setFont(e.target.value)}
          className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none"
        >
          <option value="">System default</option>
          {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Border radius */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Border Radius</p>
        <input
          type="text"
          value={tokens['--radius'] ?? '0.5rem'}
          onChange={e => setToken('--radius', e.target.value)}
          placeholder="0.5rem"
          className="rounded border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Live preview */}
      <div className="rounded border border-border p-3" style={previewStyle as React.CSSProperties}>
        <p className="mb-2 text-xs text-muted-foreground">Preview</p>
        <button
          type="button"
          className="rounded px-3 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: tokens['--brand-primary'] ?? '#6366f1' }}
        >
          Sample Button
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Theme'}
      </button>
    </div>
  )
}

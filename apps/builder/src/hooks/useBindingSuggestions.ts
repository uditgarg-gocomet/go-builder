'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'

export interface BindingSuggestion {
  path: string
  label: string
  category: string
}

export function useBindingSuggestions(): BindingSuggestion[] {
  const dataSources = useAppStore(s => s.dataSources)
  const stateSlots = useAppStore(s => s.stateSlots)
  const forms = useAppStore(s => s.forms)

  return useMemo(() => {
    const suggestions: BindingSuggestion[] = []

    // user context
    for (const path of ['user.id', 'user.email', 'user.groups']) {
      suggestions.push({ path, label: path, category: 'User' })
    }

    // env context
    for (const path of ['env.appId', 'env.environment']) {
      suggestions.push({ path, label: path, category: 'Env' })
    }

    // data sources
    for (const ds of dataSources) {
      suggestions.push({ path: `datasource.${ds.alias}`, label: `datasource.${ds.alias}`, category: 'Data Source' })
      const paths = (ds as { bindingPaths?: string[] }).bindingPaths ?? []
      for (const bp of paths) {
        suggestions.push({
          path: `datasource.${ds.alias}.${bp}`,
          label: `datasource.${ds.alias}.${bp}`,
          category: 'Data Source',
        })
      }
    }

    // state slots
    for (const slot of stateSlots) {
      suggestions.push({ path: `state.${slot.name}`, label: `state.${slot.name}`, category: 'State' })
    }

    // forms
    for (const form of forms) {
      suggestions.push({ path: `form.${form.id}.isValid`, label: `form.${form.id}.isValid`, category: 'Form' })
      suggestions.push({ path: `form.${form.id}.isSubmitting`, label: `form.${form.id}.isSubmitting`, category: 'Form' })
      for (const field of form.fields) {
        suggestions.push({
          path: `form.${form.id}.values.${field.name}`,
          label: `form.${form.id}.values.${field.name}`,
          category: 'Form',
        })
        suggestions.push({
          path: `form.${form.id}.errors.${field.name}`,
          label: `form.${form.id}.errors.${field.name}`,
          category: 'Form',
        })
      }
    }

    return suggestions
  }, [dataSources, stateSlots, forms])
}

import type { FieldValidationDef } from '@portal/core'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^https?:\/\/.+/

export async function runValidation(rule: FieldValidationDef, value: unknown): Promise<string | null> {
  const strVal = value != null ? String(value) : ''

  switch (rule.type) {
    case 'required':
      if (value == null || strVal.trim() === '') return rule.message ?? 'This field is required'
      break

    case 'minLength': {
      const min = Number(rule.value)
      if (isFinite(min) && strVal.length < min) {
        return rule.message ?? `Minimum ${min} characters required`
      }
      break
    }

    case 'maxLength': {
      const max = Number(rule.value)
      if (isFinite(max) && strVal.length > max) {
        return rule.message ?? `Maximum ${max} characters allowed`
      }
      break
    }

    case 'min': {
      const min = Number(rule.value)
      const num = Number(value)
      if (isFinite(min) && (!isFinite(num) || num < min)) {
        return rule.message ?? `Minimum value is ${min}`
      }
      break
    }

    case 'max': {
      const max = Number(rule.value)
      const num = Number(value)
      if (isFinite(max) && (!isFinite(num) || num > max)) {
        return rule.message ?? `Maximum value is ${max}`
      }
      break
    }

    case 'pattern': {
      if (rule.value != null) {
        const re = new RegExp(String(rule.value))
        if (!re.test(strVal)) return rule.message ?? 'Invalid format'
      }
      break
    }

    case 'email':
      if (!EMAIL_RE.test(strVal)) return rule.message ?? 'Invalid email address'
      break

    case 'url':
      if (!URL_RE.test(strVal)) return rule.message ?? 'Invalid URL'
      break

    case 'custom': {
      // rule.value holds the JSONata expression string
      const expression = rule.value != null ? String(rule.value) : null
      if (expression) {
        try {
          const { default: jsonata } = await import('jsonata')
          const expr = jsonata(expression)
          const result = await expr.evaluate({ value, strVal })
          if (!result) return rule.message ?? 'Validation failed'
        } catch {
          return rule.message ?? 'Validation error'
        }
      }
      break
    }
  }

  return null
}

export async function runValidations(rules: FieldValidationDef[], value: unknown): Promise<string | null> {
  for (const rule of rules) {
    const error = await runValidation(rule, value)
    if (error) return error
  }
  return null
}

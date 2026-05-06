import { z } from 'zod'

export const ActionTypeSchema = z.enum([
  'API_CALL',
  'NAVIGATE',
  'SET_STATE',
  'SHOW_TOAST',
  'OPEN_MODAL',
  'CLOSE_MODAL',
  'SUBMIT_FORM',
  'RESET_FORM',
  'TRIGGER_WEBHOOK',
  'RUN_SEQUENCE',
  'CONDITIONAL',
  'INVALIDATE_DATASOURCE',
])

export const ActionOutcomeSchema = z.object({
  onSuccess: z.array(z.string()).optional(),
  onError: z.array(z.string()).optional(),
})

export const ApiCallConfigSchema = z.object({
  endpointId: z.string().optional(),
  connectorId: z.string().optional(),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  transform: z.string().optional(),
})

export const ActionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ActionTypeSchema,
  config: z.unknown(),
  outcomes: ActionOutcomeSchema.optional(),
})

export const FormFieldDefSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'number', 'select', 'checkbox', 'textarea', 'date']),
  required: z.boolean().default(false),
  validation: z.unknown().optional(),
  defaultValue: z.unknown().optional(),
})

export const FormDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(FormFieldDefSchema),
  submitActionId: z.string(),
  resetOnSuccess: z.boolean().default(true),
})

export type ActionType = z.infer<typeof ActionTypeSchema>
export type ActionOutcome = z.infer<typeof ActionOutcomeSchema>
export type ApiCallConfig = z.infer<typeof ApiCallConfigSchema>
export type ActionDef = z.infer<typeof ActionDefSchema>
export type FormFieldDef = z.infer<typeof FormFieldDefSchema>
export type FormDef = z.infer<typeof FormDefSchema>

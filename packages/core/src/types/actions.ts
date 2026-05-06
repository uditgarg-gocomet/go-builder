import { z } from 'zod'

// ── Action types ──────────────────────────────────────────────────────────────

export const ActionTypeSchema = z.enum([
  'API_CALL',
  'REFRESH_DATASOURCE',
  'NAVIGATE',
  'OPEN_URL',
  'SET_STATE',
  'RESET_STATE',
  'TOGGLE_STATE',
  'SHOW_MODAL',
  'CLOSE_MODAL',
  'SHOW_TOAST',
  'SHOW_CONFIRM',
  'SUBMIT_FORM',
  'RESET_FORM',
  'SET_FORM_VALUE',
  'TRIGGER_WEBHOOK',
  'RUN_SEQUENCE',
  'RUN_PARALLEL',
  'CONDITIONAL',
  'DELAY',
])

export type ActionType = z.infer<typeof ActionTypeSchema>

// ── Action outcomes ───────────────────────────────────────────────────────────

export const ActionOutcomeSchema = z.object({
  onSuccess: z.array(z.string()).optional(),
  onError: z.array(z.string()).optional(),
})

export type ActionOutcome = z.infer<typeof ActionOutcomeSchema>

// ── Per-type config schemas ───────────────────────────────────────────────────

export const ApiCallConfigSchema = z.object({
  endpointId: z.string().optional(),
  connectorId: z.string().optional(),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.unknown()).optional(),
  body: z.unknown().optional(),
  transform: z.string().optional(),
  outcomes: ActionOutcomeSchema.optional(),
})

export const RefreshDatasourceConfigSchema = z.object({
  alias: z.string(),
})

export const NavigateConfigSchema = z.object({
  pageSlug: z.string().optional(),
  url: z.string().optional(),
  params: z.record(z.string(), z.string()).optional(),
})

export const OpenUrlConfigSchema = z.object({
  url: z.string(),
  newTab: z.boolean().default(true),
})

export const SetStateConfigSchema = z.object({
  key: z.string(),
  value: z.unknown(),
})

export const ResetStateConfigSchema = z.object({
  key: z.string(),
})

export const ToggleStateConfigSchema = z.object({
  key: z.string(),
})

export const ShowModalConfigSchema = z.object({
  modalId: z.string(),
})

export const CloseModalConfigSchema = z.object({
  modalId: z.string().optional(),
})

export const ShowToastConfigSchema = z.object({
  message: z.string(),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  durationMs: z.number().int().positive().default(4000),
})

export const ShowConfirmConfigSchema = z.object({
  title: z.string(),
  message: z.string(),
  confirmLabel: z.string().default('Confirm'),
  cancelLabel: z.string().default('Cancel'),
  onConfirm: z.string().optional(),
  onCancel: z.string().optional(),
})

export const SubmitFormConfigSchema = z.object({
  formId: z.string(),
})

export const ResetFormConfigSchema = z.object({
  formId: z.string(),
})

export const SetFormValueConfigSchema = z.object({
  formId: z.string(),
  field: z.string(),
  value: z.unknown(),
})

export const TriggerWebhookConfigSchema = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
})

export const RunSequenceConfigSchema = z.object({
  steps: z.array(z.string()),
  stopOnError: z.boolean().default(true),
})

export const RunParallelConfigSchema = z.object({
  steps: z.array(z.string()),
  waitForAll: z.boolean().default(true),
})

export const ConditionalConfigSchema = z.object({
  condition: z.string(),
  onTrue: z.string().optional(),
  onFalse: z.string().optional(),
})

export const DelayConfigSchema = z.object({
  ms: z.number().int().positive(),
})

// ── ActionDef ─────────────────────────────────────────────────────────────────

export const ActionDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: ActionTypeSchema,
  config: z.record(z.string(), z.unknown()),
  outcomes: ActionOutcomeSchema.optional(),
})

// ── ActionBinding + ActionTrigger ─────────────────────────────────────────────

export const ActionBindingSchema = z.object({
  trigger: z.string(),
  actionId: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
})

export const ActionTriggerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
})

// ── Form types ────────────────────────────────────────────────────────────────

export const ValidationTypeSchema = z.enum([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'pattern',
  'email',
  'url',
  'custom',
])

export const FieldValidationDefSchema = z.object({
  type: ValidationTypeSchema,
  value: z.unknown().optional(),
  message: z.string().optional(),
})

export const FormFieldDefSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'number', 'select', 'multiselect', 'checkbox', 'textarea', 'date', 'file']),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validations: z.array(FieldValidationDefSchema).optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
})

export const FormDefSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  fields: z.array(FormFieldDefSchema),
  submitActionId: z.string().optional(),
  resetOnSubmit: z.boolean().default(true),
})

// ── TypeScript types ──────────────────────────────────────────────────────────

export type ApiCallConfig = z.infer<typeof ApiCallConfigSchema>
export type RefreshDatasourceConfig = z.infer<typeof RefreshDatasourceConfigSchema>
export type NavigateConfig = z.infer<typeof NavigateConfigSchema>
export type OpenUrlConfig = z.infer<typeof OpenUrlConfigSchema>
export type SetStateConfig = z.infer<typeof SetStateConfigSchema>
export type ResetStateConfig = z.infer<typeof ResetStateConfigSchema>
export type ToggleStateConfig = z.infer<typeof ToggleStateConfigSchema>
export type ShowModalConfig = z.infer<typeof ShowModalConfigSchema>
export type CloseModalConfig = z.infer<typeof CloseModalConfigSchema>
export type ShowToastConfig = z.infer<typeof ShowToastConfigSchema>
export type ShowConfirmConfig = z.infer<typeof ShowConfirmConfigSchema>
export type SubmitFormConfig = z.infer<typeof SubmitFormConfigSchema>
export type ResetFormConfig = z.infer<typeof ResetFormConfigSchema>
export type SetFormValueConfig = z.infer<typeof SetFormValueConfigSchema>
export type TriggerWebhookConfig = z.infer<typeof TriggerWebhookConfigSchema>
export type RunSequenceConfig = z.infer<typeof RunSequenceConfigSchema>
export type RunParallelConfig = z.infer<typeof RunParallelConfigSchema>
export type ConditionalConfig = z.infer<typeof ConditionalConfigSchema>
export type DelayConfig = z.infer<typeof DelayConfigSchema>
export type ActionDef = z.infer<typeof ActionDefSchema>
export type ActionBinding = z.infer<typeof ActionBindingSchema>
export type ActionTrigger = z.infer<typeof ActionTriggerSchema>
export type ValidationType = z.infer<typeof ValidationTypeSchema>
export type FieldValidationDef = z.infer<typeof FieldValidationDefSchema>
export type FormFieldDef = z.infer<typeof FormFieldDefSchema>
export type FormDef = z.infer<typeof FormDefSchema>


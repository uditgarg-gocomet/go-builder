import { z } from 'zod'

export const ActionLogEntrySchema = z.object({
  correlationId: z.string().optional(),
  appId: z.string().min(1),
  pageId: z.string().min(1),
  userId: z.string().min(1),
  actionId: z.string().min(1),
  actionName: z.string().min(1),
  actionType: z.string().min(1),
  status: z.enum(['SUCCESS', 'ERROR', 'DENIED']),
  durationMs: z.number().int().nonnegative(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  executedAt: z.string().datetime().optional(),
})

export type ActionLogEntry = z.infer<typeof ActionLogEntrySchema>

export const IngestRequestSchema = z.object({
  events: z.array(ActionLogEntrySchema).min(1).max(100, {
    message: 'Batch exceeds maximum of 100 events',
  }),
})

export const QueryFiltersSchema = z.object({
  appId: z.string().min(1),
  pageId: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['SUCCESS', 'ERROR', 'DENIED']).optional(),
  limit: z.coerce.number().int().positive().default(50),
})

export type QueryFilters = z.infer<typeof QueryFiltersSchema>

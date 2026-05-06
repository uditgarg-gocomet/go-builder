import { z } from 'zod'

// ── Generic paginated response ────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Standard error response ───────────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number(),
  correlationId: z.string().optional(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

// ── Health check ──────────────────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'down']),
  service: z.string(),
  timestamp: z.string(),
  checks: z.record(z.string(), z.object({ status: z.enum(['ok', 'error']) })).optional(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type Pagination = z.infer<typeof PaginationSchema>

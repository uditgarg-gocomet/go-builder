import { z } from 'zod'

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

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  correlationId: z.string().optional(),
})

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  postgres: z.enum(['ok', 'error']),
  redis: z.enum(['ok', 'error']),
  timestamp: z.string(),
  version: z.string(),
})

export type Pagination = z.infer<typeof PaginationSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>

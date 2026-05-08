// ── Browser-side service ─────────────────────────────────────────────────────
// One function per real-API hop. Mock paths read from fixtures + the
// realistic extraction-details payload you supplied.

import mockExtractionFixture from '../shared/fixtures/mockExtractionResponse.json'
import mockVerificationFixture from '../shared/fixtures/mockVerificationResponse.json'
import { MOCK_MESSAGES, REAL_API_ROUTES } from '../shared/constants.js'
import type {
  ApprovalRequest,
  ApprovalStatus,
  ExtractionDetailsResponse,
  FetchExtractionRequest,
  FetchVerificationRequest,
  RetryRequest,
  ServiceOptions,
  VerificationDetailsResponse,
} from '../shared/types.js'

// ── Fetch extraction ────────────────────────────────────────────────────────

export interface FetchExtractionResult {
  ok: boolean
  data?: ExtractionDetailsResponse
  error?: string
}

export async function fetchExtraction(
  request: FetchExtractionRequest,
  opts: ServiceOptions = {},
): Promise<FetchExtractionResult> {
  if (opts.apiMode === 'real') {
    const res = await realFetch('extraction', request)
    return { ok: res.ok, data: res.data as ExtractionDetailsResponse | undefined, error: res.error }
  }
  await delay(opts.mockDelayMs)
  return { ok: true, data: mockExtractionFixture as unknown as ExtractionDetailsResponse }
}

// ── Fetch verification ──────────────────────────────────────────────────────

export interface FetchVerificationResult {
  ok: boolean
  data?: VerificationDetailsResponse
  error?: string
}

export async function fetchVerification(
  request: FetchVerificationRequest,
  opts: ServiceOptions = {},
): Promise<FetchVerificationResult> {
  if (opts.apiMode === 'real') {
    const res = await realFetch('verification', request)
    return { ok: res.ok, data: res.data as VerificationDetailsResponse | undefined, error: res.error }
  }
  await delay(opts.mockDelayMs)
  return { ok: true, data: mockVerificationFixture as unknown as VerificationDetailsResponse }
}

// ── Submit approval (verify / reject / reverify) ───────────────────────────

export interface ApprovalResult {
  ok: boolean
  message?: string
  error?: string
}

export async function submitApproval(
  request: ApprovalRequest,
  opts: ServiceOptions = {},
): Promise<ApprovalResult> {
  if (opts.apiMode === 'real') return realSubmitApproval(request)
  await delay(opts.mockDelayMs)
  return { ok: true, message: MOCK_MESSAGES.approvalSuccess }
}

// ── Trigger retry ──────────────────────────────────────────────────────────

export interface RetryResult {
  ok: boolean
  triggeredCount?: number
  message?: string
  error?: string
}

export async function submitRetry(
  request: RetryRequest,
  opts: ServiceOptions = {},
): Promise<RetryResult> {
  if (opts.apiMode === 'real') return realSubmitRetry(request)
  await delay(opts.mockDelayMs)
  return { ok: true, triggeredCount: 1, message: MOCK_MESSAGES.retrySuccess }
}

// ── Internals ──────────────────────────────────────────────────────────────

function delay(ms: number | undefined): Promise<void> {
  return new Promise(r => setTimeout(r, ms ?? 800))
}

interface ProxyResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

async function realFetch(
  kind: 'extraction' | 'verification',
  request: { swaId: string; documentBucketId: string; checklistTags: ReadonlyArray<string>; checklistId: string },
): Promise<{ ok: boolean; data?: ExtractionDetailsResponse | VerificationDetailsResponse; error?: string }> {
  const url = new URL(
    kind === 'extraction' ? REAL_API_ROUTES.extraction : REAL_API_ROUTES.verification,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002',
  )
  url.searchParams.set('swaId', request.swaId)
  url.searchParams.set('documentBucketId', request.documentBucketId)
  url.searchParams.set('checklistId', request.checklistId)
  for (const tag of request.checklistTags) {
    url.searchParams.append('checklistTags', tag)
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }

  let json: ProxyResponse<ExtractionDetailsResponse | VerificationDetailsResponse> | null = null
  try {
    json = (await res.json()) as ProxyResponse<ExtractionDetailsResponse | VerificationDetailsResponse>
  } catch { /* fallthrough */ }

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error ?? `Request failed (${res.status})` }
  }
  return { ok: true, data: json.data }
}

interface ApprovalProxyBody {
  swaId: string
  workflowDocumentComparisonId: string
  approvalStatus: ApprovalStatus
  reason?: string
  remarks?: string
}

async function realSubmitApproval(request: ApprovalRequest): Promise<ApprovalResult> {
  const payload: ApprovalProxyBody = {
    swaId: request.swaId,
    workflowDocumentComparisonId: request.workflowDocumentComparisonId,
    approvalStatus: request.approvalStatus,
  }
  if (request.reason) payload.reason = request.reason
  if (request.remarks) payload.remarks = request.remarks

  let res: Response
  try {
    res = await fetch(REAL_API_ROUTES.approval, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }

  let json: { ok: boolean; message?: string; error?: string } | null = null
  try { json = await res.json() } catch { /* fallthrough */ }

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error ?? `Request failed (${res.status})` }
  }
  return { ok: true, message: json.message }
}

async function realSubmitRetry(request: RetryRequest): Promise<RetryResult> {
  let res: Response
  try {
    res = await fetch(REAL_API_ROUTES.retry, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swaId: request.swaId, documentBucketId: request.documentBucketId }),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }

  let json: { ok: boolean; triggeredCount?: number; message?: string; error?: string } | null = null
  try { json = await res.json() } catch { /* fallthrough */ }

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error ?? `Request failed (${res.status})` }
  }
  return { ok: true, triggeredCount: json.triggeredCount, message: json.message }
}

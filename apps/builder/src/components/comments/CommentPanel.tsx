'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

interface CommentReply {
  id: string
  body: string
  createdBy: string
  createdAt: string
}

interface Comment {
  id: string
  nodeId: string
  body: string
  resolved: boolean
  createdBy: string
  createdAt: string
  replies: CommentReply[]
}

interface CommentPanelProps {
  appId: string
  userId: string
}

export function CommentPanel({ appId, userId }: CommentPanelProps): React.ReactElement {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const activePageId = usePageStore(s => s.activePageId)

  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyBody, setReplyBody] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const fetchComments = useCallback(async (): Promise<void> => {
    if (!activePageId || !selectedNodeId) return
    setLoading(true)
    try {
      const res = await fetch(
        `${BACKEND_URL}/apps/${appId}/pages/${activePageId}/comments?nodeId=${selectedNodeId}`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const data = (await res.json()) as { comments: Comment[] }
        setComments(data.comments ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [appId, activePageId, selectedNodeId])

  useEffect(() => { void fetchComments() }, [fetchComments])

  const handleAddComment = async (): Promise<void> => {
    if (!newBody.trim() || !activePageId || !selectedNodeId) return
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND_URL}/apps/${appId}/pages/${activePageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nodeId: selectedNodeId, body: newBody.trim(), createdBy: userId }),
      })
      if (res.ok) {
        const data = (await res.json()) as { comment: Comment }
        setComments(cs => [data.comment, ...cs])
        setNewBody('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (commentId: string): Promise<void> => {
    if (!activePageId) return
    const res = await fetch(
      `${BACKEND_URL}/apps/${appId}/pages/${activePageId}/comments/${commentId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolved: true, resolvedBy: userId }),
      }
    )
    if (res.ok) {
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, resolved: true } : c))
    }
  }

  const handleReply = async (commentId: string): Promise<void> => {
    const body = replyBody[commentId]?.trim()
    if (!body || !activePageId) return
    const res = await fetch(
      `${BACKEND_URL}/apps/${appId}/pages/${activePageId}/comments/${commentId}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body, createdBy: userId }),
      }
    )
    if (res.ok) {
      const data = (await res.json()) as { reply: CommentReply }
      setComments(cs => cs.map(c =>
        c.id === commentId ? { ...c, replies: [...c.replies, data.reply] } : c
      ))
      setReplyBody(rb => ({ ...rb, [commentId]: '' }))
      setReplyingTo(null)
    }
  }

  if (!selectedNodeId) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Comments</h3>
        <p className="text-xs text-muted-foreground">Select a node to view comments.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Comments</h3>

      {/* New comment input */}
      <div className="flex flex-col gap-2">
        <textarea
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) void handleAddComment() }}
          placeholder="Add a comment… (⌘↵ to submit)"
          rows={2}
          className="rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <button
          type="button"
          onClick={() => void handleAddComment()}
          disabled={submitting || !newBody.trim()}
          className="self-end rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      {/* Comment list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments on this node.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map(comment => (
            <div
              key={comment.id}
              className={`flex flex-col gap-2 rounded border p-3 ${
                comment.resolved ? 'border-border/50 opacity-60' : 'border-border bg-background'
              }`}
            >
              {/* Comment header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-foreground">{comment.createdBy}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                {!comment.resolved && (
                  <button
                    type="button"
                    onClick={() => void handleResolve(comment.id)}
                    className="shrink-0 text-[10px] text-muted-foreground hover:text-green-600"
                  >
                    ✓ Resolve
                  </button>
                )}
                {comment.resolved && (
                  <span className="shrink-0 text-[10px] text-green-600">Resolved</span>
                )}
              </div>

              <p className="text-sm text-foreground">{comment.body}</p>

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className="ml-3 flex flex-col gap-1.5 border-l border-border pl-3">
                  {comment.replies.map(reply => (
                    <div key={reply.id}>
                      <span className="text-[10px] font-medium text-foreground">{reply.createdBy}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        {new Date(reply.createdAt).toLocaleString()}
                      </span>
                      <p className="text-xs text-foreground">{reply.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {!comment.resolved && (
                <>
                  {replyingTo === comment.id ? (
                    <div className="flex gap-2">
                      <input
                        value={replyBody[comment.id] ?? ''}
                        onChange={e => setReplyBody(rb => ({ ...rb, [comment.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') void handleReply(comment.id) }}
                        placeholder="Reply…"
                        className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => void handleReply(comment.id)}
                        className="rounded bg-secondary px-2 py-1 text-[10px] text-secondary-foreground hover:bg-secondary/80"
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="text-[10px] text-muted-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(comment.id)}
                      className="self-start text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Reply
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

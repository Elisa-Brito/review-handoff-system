Now I have enough context on the project style. This is a React Native / web hybrid project. However, the request specifies `"use client"` which is a Next.js directive, and the component uses web-specific features (textarea, DOM selectors). Let me generate the component.
"use client"

import React, { useState, useRef, useEffect } from 'react'

export type ProjectRole = 'viewer' | 'commenter' | 'editor' | 'admin' | 'owner'

export interface CommentAuthor {
  id: string
  name: string
  email?: string
}

export interface Comment {
  id: string
  threadId: string
  authorId: string
  author: CommentAuthor
  content: string
  createdAt: string
  updatedAt?: string
  isEdited: boolean
  isDeleted: boolean
  parentId: string | null
}

export interface ThreadWithComments {
  id: string
  pinNumber: number
  status: 'open' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'critical'
  screenName: string
  element: string
  createdAt: string
  comments: Comment[]
}

interface ThreadPanelProps {
  thread: ThreadWithComments | null
  currentUserId: string
  userRole: ProjectRole
  onResolve: () => void
  onReopen: () => void
  onAddReply: (content: string) => Promise<void>
  onEditComment: (commentId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
  onClose: () => void
}

const USER_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706',
  '#059669', '#0284C7', '#9333EA', '#C026D3', '#0F766E',
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMo = Math.floor(diffDay / 30)
  if (diffMo < 12) return `${diffMo}mo ago`
  return `${Math.floor(diffMo / 12)}y ago`
}

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CONFIG = {
  open: { label: 'Open', bg: '#DBEAFE', color: '#1D4ED8' },
  resolved: { label: 'Resolved', bg: '#D1FAE5', color: '#065F46' },
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', bg: '#F3F4F6', color: '#374151' },
  medium: { label: 'Medium', bg: '#FEF3C7', color: '#92400E' },
  high: { label: 'High', bg: '#FEE2E2', color: '#991B1B' },
  critical: { label: 'Critical', bg: '#FDF2F8', color: '#9D174D' },
}

interface AutosizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number
  maxRows?: number
}

function AutosizeTextarea({ minRows = 2, maxRows = 6, value, onChange, ...rest }: AutosizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10)
    const minH = minRows * lineHeight
    const maxH = maxRows * lineHeight
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`
  }, [value, minRows, maxRows])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      style={{
        resize: 'none',
        overflowY: 'auto',
        lineHeight: '20px',
        minHeight: `${minRows * 20}px`,
        maxHeight: `${maxRows * 20}px`,
      }}
      {...rest}
    />
  )
}

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  userRole: ProjectRole
  onEdit: (commentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

function CommentItem({ comment, currentUserId, userRole, onEdit, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(comment.content)
  const [saving, setSaving] = useState(false)

  const isOwn = comment.authorId === currentUserId
  const isAdmin = userRole === 'admin' || userRole === 'owner'
  const canEdit = isOwn && !comment.isDeleted
  const canDelete = (isOwn || isAdmin) && !comment.isDeleted

  async function handleSaveEdit() {
    if (!editValue.trim() || editValue === comment.content) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      await onEdit(comment.id, editValue.trim())
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditValue(comment.content)
    setIsEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this comment?')) return
    await onDelete(comment.id)
  }

  const color = getUserColor(comment.authorId)
  const initials = getInitials(comment.author.name)

  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 16px' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {comment.author.name}
          </span>
          {comment.isEdited && !comment.isDeleted && (
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>(edited)</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              title={formatAbsoluteTime(comment.createdAt)}
              style={{ fontSize: 11, color: '#9CA3AF', cursor: 'default', whiteSpace: 'nowrap' }}
            >
              {formatRelativeTime(comment.createdAt)}
            </span>
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                style={iconBtnStyle}
                title="Edit comment"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                style={{ ...iconBtnStyle, color: '#EF4444' }}
                title="Delete comment"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {comment.isDeleted ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
            [Comment deleted]
          </p>
        ) : isEditing ? (
          <div style={{ marginTop: 4 }}>
            <AutosizeTextarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{
                width: '100%',
                fontSize: 13,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #6366F1',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                color: '#111827',
                background: '#F9FAFB',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editValue.trim()}
                style={primarySmallBtnStyle}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancelEdit} style={secondarySmallBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#374151', margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </p>
        )}
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 3,
  display: 'flex',
  alignItems: 'center',
  color: '#6B7280',
  borderRadius: 4,
}

const primarySmallBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#4F46E5',
  color: '#fff',
  cursor: 'pointer',
}

const secondarySmallBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
}

export function ThreadPanel({
  thread,
  currentUserId,
  userRole,
  onResolve,
  onReopen,
  onAddReply,
  onEditComment,
  onDeleteComment,
  onClose,
}: ThreadPanelProps) {
  const [replyValue, setReplyValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (thread) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [thread?.comments.length])

  if (!thread) return null

  const statusCfg = STATUS_CONFIG[thread.status]
  const priorityCfg = PRIORITY_CONFIG[thread.priority]
  const isResolved = thread.status === 'resolved'

  async function handleSubmitReply() {
    const trimmed = replyValue.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await onAddReply(trimmed)
      setReplyValue('')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmitReply()
    }
  }

  const canComment = userRole !== 'viewer'

  return (
    <div
      style={{
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
        borderLeft: '1px solid #E5E7EB',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E5E7EB',
          background: '#F9FAFB',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#111827',
              background: '#E0E7FF',
              borderRadius: 5,
              padding: '2px 7px',
            }}
          >
            #{thread.pinNumber}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 20,
              padding: '2px 8px',
              background: statusCfg.bg,
              color: statusCfg.color,
            }}
          >
            {statusCfg.label}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 20,
              padding: '2px 8px',
              background: priorityCfg.bg,
              color: priorityCfg.color,
            }}
          >
            {priorityCfg.label}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              onClick={isResolved ? onReopen : onResolve}
              title={isResolved ? 'Reopen thread' : 'Resolve thread'}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 6,
                border: `1px solid ${isResolved ? '#D1D5DB' : '#10B981'}`,
                background: isResolved ? '#fff' : '#ECFDF5',
                color: isResolved ? '#374151' : '#065F46',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isResolved ? 'Reopen' : 'Resolve'}
            </button>
            <button onClick={onClose} style={iconBtnStyle} title="Close panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {thread.screenName}
            </span>
          </div>
          {thread.element && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <code
                style={{
                  fontSize: 11,
                  color: '#6B7280',
                  background: '#F3F4F6',
                  padding: '1px 5px',
                  borderRadius: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                  display: 'block',
                }}
                title={thread.element}
              >
                {thread.element}
              </code>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span
              style={{ fontSize: 12, color: '#9CA3AF', cursor: 'default' }}
              title={formatAbsoluteTime(thread.createdAt)}
            >
              {formatRelativeTime(thread.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {thread.comments.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            No comments yet. Start the conversation below.
          </div>
        ) : (
          thread.comments.map((comment, idx) => (
            <React.Fragment key={comment.id}>
              {idx > 0 && comment.parentId === null && (
                <div style={{ height: 1, background: '#F3F4F6', margin: '2px 16px' }} />
              )}
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                userRole={userRole}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
              />
            </React.Fragment>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Audit trail link */}
      <div style={{ padding: '4px 16px 2px', borderTop: '1px solid #F3F4F6' }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            color: '#6366F1',
            padding: '4px 0',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          View comment history
        </button>
      </div>

      {/* Reply input */}
      {canComment && (
        <div
          style={{
            padding: '10px 16px 14px',
            borderTop: '1px solid #E5E7EB',
            background: '#F9FAFB',
            flexShrink: 0,
          }}
        >
          <AutosizeTextarea
            value={replyValue}
            onChange={(e) => setReplyValue(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder="Reply… (Ctrl+Enter to send)"
            style={{
              width: '100%',
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #D1D5DB',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              color: '#111827',
              background: '#fff',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSubmitReply}
              disabled={submitting || !replyValue.trim()}
              style={{
                ...primarySmallBtnStyle,
                opacity: submitting || !replyValue.trim() ? 0.5 : 1,
                cursor: submitting || !replyValue.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

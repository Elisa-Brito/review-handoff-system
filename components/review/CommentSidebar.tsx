"use client"

import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useState, useMemo } from 'react'
import { Search, X, MessageSquare, AlertCircle } from 'lucide-react'

export type CommentStatus = 'open' | 'resolved' | 'reopened'
export type CommentPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Comment {
  id: string
  author: {
    name: string
    avatar?: string
    initials: string
  }
  body: string
  createdAt: Date
}

export interface ThreadWithComments {
  id: string
  pinNumber: number
  status: CommentStatus
  priority?: CommentPriority
  rootComment: Comment
  replies: Comment[]
  screenId: string
}

type FilterTab = 'all' | 'open' | 'resolved'

interface CommentSidebarProps {
  threads: ThreadWithComments[]
  selectedThreadId: string | null
  onSelectThread: (id: string) => void
  isOpen: boolean
}

const STATUS_CONFIG: Record<CommentStatus, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  reopened: {
    label: 'Reopened',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
}

const PRIORITY_CONFIG: Record<CommentPriority, { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
}

function Avatar({ author }: { author: Comment['author'] }) {
  if (author.avatar) {
    return (
      <img
        src={author.avatar}
        alt={author.name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-semibold text-white leading-none">
        {author.initials}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: CommentStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: CommentPriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; body: string }> = {
    all: {
      title: 'No comments yet',
      body: 'Pin a comment on the canvas to start a thread.',
    },
    open: {
      title: 'No open threads',
      body: 'All threads have been resolved.',
    },
    resolved: {
      title: 'No resolved threads',
      body: 'Resolved threads will appear here.',
    },
  }
  const msg = messages[filter]
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
        <MessageSquare className="w-5 h-5 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{msg.title}</p>
        <p className="text-xs text-slate-400 mt-1">{msg.body}</p>
      </div>
    </div>
  )
}

function SearchEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">No results found</p>
        <p className="text-xs text-slate-400 mt-1">Try a different search term.</p>
      </div>
    </div>
  )
}

function ThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: ThreadWithComments
  isSelected: boolean
  onClick: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(thread.rootComment.createdAt), {
    addSuffix: true,
  })

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-3 rounded-lg transition-colors duration-100 group
        ${isSelected
          ? 'bg-indigo-50 ring-1 ring-indigo-200'
          : 'hover:bg-slate-50'
        }
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Pin number */}
        <div
          className={`
            flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5
            text-[10px] font-bold leading-none
            ${isSelected
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-200 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600'
            }
          `}
        >
          {thread.pinNumber}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row: author + time */}
          <div className="flex items-center gap-2 mb-1">
            <Avatar author={thread.rootComment.author} />
            <span className="text-xs font-medium text-slate-800 truncate">
              {thread.rootComment.author.name}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
              {timeAgo}
            </span>
          </div>

          {/* Comment preview */}
          <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
            {thread.rootComment.body}
          </p>

          {/* Footer: badges + reply count */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={thread.status} />
            {thread.priority && <PriorityBadge priority={thread.priority} />}
            {thread.replies.length > 0 && (
              <span className="text-[10px] text-slate-400 ml-auto">
                {thread.replies.length}{' '}
                {thread.replies.length === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

export function CommentSidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  isOpen,
}: CommentSidebarProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredThreads = useMemo(() => {
    let result = threads

    if (activeFilter === 'open') {
      result = result.filter((t) => t.status === 'open' || t.status === 'reopened')
    } else if (activeFilter === 'resolved') {
      result = result.filter((t) => t.status === 'resolved')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.rootComment.body.toLowerCase().includes(q) ||
          t.rootComment.author.name.toLowerCase().includes(q) ||
          t.replies.some((r) => r.body.toLowerCase().includes(q))
      )
    }

    return result
  }, [threads, activeFilter, searchQuery])

  const counts = useMemo(
    () => ({
      all: threads.length,
      open: threads.filter((t) => t.status === 'open' || t.status === 'reopened').length,
      resolved: threads.filter((t) => t.status === 'resolved').length,
    }),
    [threads]
  )

  const showSearchEmpty = searchQuery.trim().length > 0 && filteredThreads.length === 0
  const showFilterEmpty = !searchQuery.trim() && filteredThreads.length === 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
          />

          {/* Sidebar panel */}
          <motion.aside
            key="sidebar"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
            className={`
              fixed top-0 right-0 bottom-0 z-40
              w-full md:w-80
              bg-white border-l border-slate-200
              flex flex-col shadow-xl
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-slate-800">Comments</h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
              </span>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="
                    w-full pl-8 pr-8 py-1.5 text-xs
                    bg-slate-50 border border-slate-200 rounded-md
                    placeholder:text-slate-400 text-slate-700
                    focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                    transition-colors
                  "
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-100 flex-shrink-0">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                    ${activeFilter === tab.key
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  {tab.label}
                  <span
                    className={`
                      text-[10px] tabular-nums px-1 py-0.5 rounded-full leading-none
                      ${activeFilter === tab.key
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-slate-100 text-slate-400'
                      }
                    `}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
              {showSearchEmpty ? (
                <SearchEmptyState />
              ) : showFilterEmpty ? (
                <EmptyState filter={activeFilter} />
              ) : (
                filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === selectedThreadId}
                    onClick={() => onSelectThread(thread.id)}
                  />
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

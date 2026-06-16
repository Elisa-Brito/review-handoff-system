"use client"

import { useState, useCallback } from "react"

export type CommentStatus = "open" | "resolved"

export interface Reply {
  id: string
  content: string
  authorId: string
  createdAt: string
  updatedAt: string
}

export interface Thread {
  id: string
  screenId: string
  projectId: string
  content: string
  status: CommentStatus
  authorId: string
  createdAt: string
  updatedAt: string
  replies: Reply[]
}

export interface CreateThreadData {
  content: string
  authorId: string
  x?: number
  y?: number
}

export function useComments(screenId: string, projectId: string) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/comments?screen_id=${encodeURIComponent(screenId)}&project_id=${encodeURIComponent(projectId)}`
      )
      if (!res.ok) throw new Error(`Failed to fetch threads: ${res.status}`)
      const data: Thread[] = await res.json()
      setThreads(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [screenId, projectId])

  const createThread = useCallback(
    async (data: CreateThreadData) => {
      const optimisticThread: Thread = {
        id: `optimistic-${Date.now()}`,
        screenId,
        projectId,
        content: data.content,
        status: "open",
        authorId: data.authorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
      }
      setThreads((prev) => [optimisticThread, ...prev])

      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, screenId, projectId }),
        })
        if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`)
        const created: Thread = await res.json()
        setThreads((prev) =>
          prev.map((t) => (t.id === optimisticThread.id ? created : t))
        )
        return created
      } catch (err) {
        setThreads((prev) => prev.filter((t) => t.id !== optimisticThread.id))
        setError(err instanceof Error ? err.message : "Unknown error")
        throw err
      }
    },
    [screenId, projectId]
  )

  const resolveThread = useCallback(async (threadId: string) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, status: "resolved" as CommentStatus } : t
      )
    )

    try {
      const res = await fetch(`/api/comments/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (!res.ok) throw new Error(`Failed to resolve thread: ${res.status}`)
      const updated: Thread = await res.json()
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)))
    } catch (err) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status: "open" as CommentStatus } : t
        )
      )
      setError(err instanceof Error ? err.message : "Unknown error")
      throw err
    }
  }, [])

  const reopenThread = useCallback(async (threadId: string) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, status: "open" as CommentStatus } : t
      )
    )

    try {
      const res = await fetch(`/api/comments/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      })
      if (!res.ok) throw new Error(`Failed to reopen thread: ${res.status}`)
      const updated: Thread = await res.json()
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)))
    } catch (err) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status: "resolved" as CommentStatus } : t
        )
      )
      setError(err instanceof Error ? err.message : "Unknown error")
      throw err
    }
  }, [])

  const addReply = useCallback(
    async (threadId: string, content: string, authorId: string) => {
      const optimisticReply: Reply = {
        id: `optimistic-reply-${Date.now()}`,
        content,
        authorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, replies: [...t.replies, optimisticReply] }
            : t
        )
      )

      try {
        const res = await fetch(`/api/comments/${threadId}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, authorId }),
        })
        if (!res.ok) throw new Error(`Failed to add reply: ${res.status}`)
        const reply: Reply = await res.json()
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  replies: t.replies.map((r) =>
                    r.id === optimisticReply.id ? reply : r
                  ),
                }
              : t
          )
        )
        return reply
      } catch (err) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  replies: t.replies.filter((r) => r.id !== optimisticReply.id),
                }
              : t
          )
        )
        setError(err instanceof Error ? err.message : "Unknown error")
        throw err
      }
    },
    []
  )

  const editComment = useCallback(
    async (commentId: string, content: string) => {
      const previousThreads = threads

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === commentId) {
            return { ...t, content, updatedAt: new Date().toISOString() }
          }
          return {
            ...t,
            replies: t.replies.map((r) =>
              r.id === commentId
                ? { ...r, content, updatedAt: new Date().toISOString() }
                : r
            ),
          }
        })
      )

      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) throw new Error(`Failed to edit comment: ${res.status}`)
      } catch (err) {
        setThreads(previousThreads)
        setError(err instanceof Error ? err.message : "Unknown error")
        throw err
      }
    },
    [threads]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      const previousThreads = threads

      const isThread = threads.some((t) => t.id === commentId)

      if (isThread) {
        setThreads((prev) => prev.filter((t) => t.id !== commentId))
      } else {
        setThreads((prev) =>
          prev.map((t) => ({
            ...t,
            replies: t.replies.filter((r) => r.id !== commentId),
          }))
        )
      }

      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error(`Failed to delete comment: ${res.status}`)
      } catch (err) {
        setThreads(previousThreads)
        setError(err instanceof Error ? err.message : "Unknown error")
        throw err
      }
    },
    [threads]
  )

  const filterByStatus = useCallback(
    (status: CommentStatus | "all") => {
      if (status === "all") return threads
      return threads.filter((t) => t.status === status)
    },
    [threads]
  )

  return {
    threads,
    loading,
    error,
    fetchThreads,
    createThread,
    resolveThread,
    reopenThread,
    addReply,
    editComment,
    deleteComment,
    filterByStatus,
  }
}

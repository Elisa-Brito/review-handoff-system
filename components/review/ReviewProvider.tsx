"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { CreateThreadSchema, ThreadWithComments } from "@/types"

interface ReviewContextValue {
  isReviewMode: boolean
  selectedThreadId: string | null
  isPinning: boolean
  pendingPin: { x: number; y: number } | null
  threads: ThreadWithComments[]
  screenId: string
  projectId: string
  isLoading: boolean
  error: string | null
  toggleReviewMode: () => void
  selectThread: (id: string | null) => void
  startPinning: () => void
  cancelPinning: () => void
  placePendingPin: (x: number, y: number) => void
  createThread: (data: CreateThreadSchema) => Promise<void>
  resolveThread: (threadId: string) => Promise<void>
  reopenThread: (threadId: string) => Promise<void>
  addReply: (threadId: string, content: string) => Promise<void>
  refreshThreads: () => Promise<void>
}

const ReviewContext = createContext<ReviewContextValue | null>(null)

interface ReviewProviderProps {
  children: React.ReactNode
  screenId: string
  projectId: string
  initialThreads?: ThreadWithComments[]
}

export function ReviewProvider({
  children,
  screenId,
  projectId,
  initialThreads = [],
}: ReviewProviderProps) {
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [isPinning, setIsPinning] = useState(false)
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [threads, setThreads] = useState<ThreadWithComments[]>(initialThreads)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshThreads = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/comments?screenId=${encodeURIComponent(screenId)}&projectId=${encodeURIComponent(projectId)}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch threads: ${response.statusText}`)
      }
      const data: ThreadWithComments[] = await response.json()
      setThreads(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch threads")
    } finally {
      setIsLoading(false)
    }
  }, [screenId, projectId])

  useEffect(() => {
    if (initialThreads.length === 0) {
      refreshThreads()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReviewMode = useCallback(() => {
    setIsReviewMode((prev) => {
      if (prev) {
        setIsPinning(false)
        setPendingPin(null)
        setSelectedThreadId(null)
      }
      return !prev
    })
  }, [])

  const selectThread = useCallback((id: string | null) => {
    setSelectedThreadId(id)
  }, [])

  const startPinning = useCallback(() => {
    setIsPinning(true)
    setPendingPin(null)
    setSelectedThreadId(null)
  }, [])

  const cancelPinning = useCallback(() => {
    setIsPinning(false)
    setPendingPin(null)
  }, [])

  const placePendingPin = useCallback((x: number, y: number) => {
    setPendingPin({ x, y })
    setIsPinning(false)
  }, [])

  const createThread = useCallback(
    async (data: CreateThreadSchema) => {
      setError(null)
      try {
        const response = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, screenId, projectId }),
        })
        if (!response.ok) {
          throw new Error(`Failed to create thread: ${response.statusText}`)
        }
        const newThread: ThreadWithComments = await response.json()
        setThreads((prev) => [...prev, newThread])
        setPendingPin(null)
        setSelectedThreadId(newThread.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create thread")
        throw err
      }
    },
    [screenId, projectId]
  )

  const resolveThread = useCallback(async (threadId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/comments/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (!response.ok) {
        throw new Error(`Failed to resolve thread: ${response.statusText}`)
      }
      const updated: ThreadWithComments = await response.json()
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? updated : t))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve thread")
      throw err
    }
  }, [])

  const reopenThread = useCallback(async (threadId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/comments/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      })
      if (!response.ok) {
        throw new Error(`Failed to reopen thread: ${response.statusText}`)
      }
      const updated: ThreadWithComments = await response.json()
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? updated : t))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen thread")
      throw err
    }
  }, [])

  const addReply = useCallback(async (threadId: string, content: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/comments/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) {
        throw new Error(`Failed to add reply: ${response.statusText}`)
      }
      const updated: ThreadWithComments = await response.json()
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? updated : t))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reply")
      throw err
    }
  }, [])

  const value: ReviewContextValue = {
    isReviewMode,
    selectedThreadId,
    isPinning,
    pendingPin,
    threads,
    screenId,
    projectId,
    isLoading,
    error,
    toggleReviewMode,
    selectThread,
    startPinning,
    cancelPinning,
    placePendingPin,
    createThread,
    resolveThread,
    reopenThread,
    addReply,
    refreshThreads,
  }

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  )
}

export function useReview(): ReviewContextValue {
  const context = useContext(ReviewContext)
  if (!context) {
    throw new Error("useReview must be used within a ReviewProvider")
  }
  return context
}

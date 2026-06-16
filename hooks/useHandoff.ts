"use client"

import { useState, useCallback } from "react"

export interface Handoff {
  id: string
  projectId: string
  screenId?: string
  status: "draft" | "published" | "archived"
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface GenerateHandoffSchema {
  title?: string
  description?: string
  includeSpecs?: boolean
  includeAssets?: boolean
  includeTokens?: boolean
  [key: string]: unknown
}

export function useHandoff(projectId: string, screenId?: string) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchHandoffs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ project_id: projectId })
      if (screenId) params.set("screen_id", screenId)
      const res = await fetch(`/api/handoffs?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to fetch handoffs: ${res.statusText}`)
      const data: Handoff[] = await res.json()
      setHandoffs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error fetching handoffs")
    } finally {
      setLoading(false)
    }
  }, [projectId, screenId])

  const generateHandoff = useCallback(async (data: GenerateHandoffSchema) => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/handoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, screen_id: screenId, ...data }),
      })
      if (!res.ok) throw new Error(`Failed to generate handoff: ${res.statusText}`)
      const created: Handoff = await res.json()
      setHandoffs((prev) => [created, ...prev])
      return created
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error generating handoff")
      return null
    } finally {
      setGenerating(false)
    }
  }, [projectId, screenId])

  const publishHandoff = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/handoffs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      })
      if (!res.ok) throw new Error(`Failed to publish handoff: ${res.statusText}`)
      const updated: Handoff = await res.json()
      setHandoffs((prev) => prev.map((h) => (h.id === id ? updated : h)))
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error publishing handoff")
      return null
    }
  }, [])

  const archiveHandoff = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/handoffs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
      if (!res.ok) throw new Error(`Failed to archive handoff: ${res.statusText}`)
      const updated: Handoff = await res.json()
      setHandoffs((prev) => prev.map((h) => (h.id === id ? updated : h)))
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error archiving handoff")
      return null
    }
  }, [])

  const exportHandoff = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/handoffs/${id}/export`)
      if (!res.ok) throw new Error(`Failed to export handoff: ${res.statusText}`)
      const blob = await res.blob()
      const contentDisposition = res.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] ?? `handoff-${id}.zip`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error exporting handoff")
    }
  }, [])

  return {
    handoffs,
    loading,
    error,
    generating,
    fetchHandoffs,
    generateHandoff,
    publishHandoff,
    archiveHandoff,
    exportHandoff,
  }
}

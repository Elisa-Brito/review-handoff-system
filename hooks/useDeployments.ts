"use client"

import { useState, useCallback } from "react"

export type DeploymentStatus = "pending" | "building" | "ready" | "failed" | "cancelled"

export interface Deployment {
  id: string
  projectId: string
  status: DeploymentStatus
  createdAt: string
  updatedAt: string
  url?: string
  meta?: Record<string, unknown>
}

export interface CreateDeploymentData {
  projectId: string
  url?: string
  meta?: Record<string, unknown>
}

export interface FetchDeploymentsOptions {
  status?: DeploymentStatus
  limit?: number
  offset?: number
}

export function useDeployments(projectId: string) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchDeployments = useCallback(
    async (options?: FetchDeploymentsOptions) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ project_id: projectId })
        if (options?.status) params.set("status", options.status)
        if (options?.limit != null) params.set("limit", String(options.limit))
        if (options?.offset != null) params.set("offset", String(options.offset))

        const res = await fetch(`/api/deployments?${params.toString()}`)
        if (!res.ok) throw new Error(`Failed to fetch deployments: ${res.status}`)
        const data: Deployment[] = await res.json()
        setDeployments(data)
        return data
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [projectId]
  )

  const createDeployment = useCallback(
    async (data: Omit<CreateDeploymentData, "projectId"> & Partial<Pick<CreateDeploymentData, "projectId">>) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, projectId }),
        })
        if (!res.ok) throw new Error(`Failed to create deployment: ${res.status}`)
        const created: Deployment = await res.json()
        setDeployments((prev) => [created, ...prev])
        return created
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [projectId]
  )

  const updateDeploymentStatus = useCallback(
    async (id: string, status: DeploymentStatus) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/deployments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) throw new Error(`Failed to update deployment status: ${res.status}`)
        const updated: Deployment = await res.json()
        setDeployments((prev) =>
          prev.map((d) => (d.id === id ? updated : d))
        )
        return updated
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const getCurrentDeployment = useCallback((): Deployment | undefined => {
    return deployments
      .filter((d) => d.status === "ready")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  }, [deployments])

  return {
    deployments,
    loading,
    error,
    fetchDeployments,
    createDeployment,
    updateDeploymentStatus,
    getCurrentDeployment,
  }
}

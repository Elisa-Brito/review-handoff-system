"use client"

import { useCallback, useState } from 'react'
import { apiClient } from 'app/lib/api/client'

export interface AuditLog {
  id: string
  projectId: string
  entityType: string
  entityId: string
  action: string
  actorId: string
  actorEmail: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AuditLogFilters {
  entityType?: string
  action?: string
  page?: number
  limit?: number
}

interface AuditLogsResponse {
  data: AuditLog[]
  total: number
  page: number
  limit: number
}

const DEFAULT_LIMIT = 20

export function useAudit(projectId: string) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [currentFilters, setCurrentFilters] = useState<AuditLogFilters>({})

  const fetchLogs = useCallback(
    async (options: AuditLogFilters = {}) => {
      const mergedFilters: AuditLogFilters = { ...currentFilters, ...options }
      const activePage = options.page ?? 1
      const limit = options.limit ?? DEFAULT_LIMIT

      setCurrentFilters({ ...mergedFilters, page: activePage, limit })
      setLoading(true)
      setError(null)

      try {
        const params: Record<string, string | number> = {
          page: activePage,
          limit,
        }

        if (mergedFilters.entityType) {
          params.entityType = mergedFilters.entityType
        }
        if (mergedFilters.action) {
          params.action = mergedFilters.action
        }

        const response = await apiClient.get<AuditLogsResponse>(
          `/projects/${projectId}/audit-logs`,
          { params },
        )

        setLogs(response.data.data)
        setTotal(response.data.total)
        setPage(response.data.page)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
      } finally {
        setLoading(false)
      }
    },
    [projectId, currentFilters],
  )

  const nextPage = useCallback(() => {
    const next = page + 1
    fetchLogs({ ...currentFilters, page: next })
  }, [page, currentFilters, fetchLogs])

  const prevPage = useCallback(() => {
    if (page <= 1) return
    const prev = page - 1
    fetchLogs({ ...currentFilters, page: prev })
  }, [page, currentFilters, fetchLogs])

  return { logs, loading, error, total, page, fetchLogs, nextPage, prevPage }
}

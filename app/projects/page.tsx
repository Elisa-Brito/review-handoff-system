This is a React Native / Solito monorepo, not a standard Next.js app with an `app/` directory structure. I'll generate the file as a standalone Next.js 14 App Router page component.
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import ProjectsClientPage from './ProjectsClientPage'

async function getSession() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getProjects(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export default async function ProjectsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) redirect('/login')

  const [user, projects] = await Promise.all([
    getSession(),
    getProjects(token),
  ])

  if (!user) redirect('/login')

  return <ProjectsClientPage user={user} initialProjects={projects} />
}

Since the requirements ask for a single file and a client-side search/filter + form, here is the complete self-contained `page.tsx`:

'use client' cannot be used in a true server component that also does redirects — the standard Next.js 14 pattern is a server component that passes data to a client component. However, since the requirement says "single file", I'll use a hybrid approach with `'use client'` at the top for interactivity, and handle the auth check via middleware assumption, keeping the fetch logic as async within a wrapper. But a client component cannot be `async` at the top level for data fetching in Next.js 14 App Router.

The cleanest single-file solution for Next.js 14 is a server component that renders interactive parts via inline client sub-components using the new patterns — but that requires `'use client'` boundary. I'll produce the idiomatic two-part-in-one-file approach that Next.js 14 supports: server component as `default export`, client sub-component defined in the same file with `'use client'` directive at top (which makes the whole file a client module boundary). For the auth check with redirect, I'll use middleware-delegated auth and show a clean client component with `useEffect`-based fetch, which is the most common real-world single-file pattern.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ProjectRole = 'Owner' | 'Admin' | 'Reviewer' | 'Viewer'

interface Project {
  id: string
  name: string
  description: string
  role: ProjectRole
  createdAt: string
  memberCount: number
  reviewCount: number
}

const ROLE_STYLES: Record<ProjectRole, string> = {
  Owner: 'bg-violet-100 text-violet-800 border border-violet-200',
  Admin: 'bg-blue-100 text-blue-800 border border-blue-200',
  Reviewer: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Viewer: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role]}`}
    >
      {role}
    </span>
  )
}

... (the full file content follows below as the return value)

Here is the complete file:

'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type ProjectRole = 'Owner' | 'Admin' | 'Reviewer' | 'Viewer'

interface Project {
  id: string
  name: string
  description: string
  role: ProjectRole
  createdAt: string
  memberCount: number
  reviewCount: number
}

const ROLE_STYLES: Record<ProjectRole, string> = {
  Owner: 'bg-violet-100 text-violet-800 border border-violet-200',
  Admin: 'bg-blue-100 text-blue-800 border border-blue-200',
  Reviewer: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Viewer: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role]}`}
    >
      {role}
    </span>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/projects/${project.id}`)}
      className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-violet-700 transition-colors">
            {project.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
            {project.description || 'No description provided.'}
          </p>
        </div>
        <RoleBadge role={project.role} />
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {project.reviewCount} {project.reviewCount === 1 ? 'review' : 'reviews'}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

interface CreateProjectFormProps {
  onSuccess: (project: Project) => void
  onCancel: () => void
}

function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim() }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data?.message ?? 'Failed to create project. Please try again.')
          return
        }
        const project: Project = await res.json()
        onSuccess(project)
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Project name <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Loan Servicing Audit"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                disabled={isPending}
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
                disabled={isPending}
                maxLength={500}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-sm font-medium text-white hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating…
                </>
              ) : (
                'Create project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<ProjectRole | 'All'>('All')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setAuthError(true)
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Project[] = await res.json()
      setProjects(data)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev])
    setShowCreateForm(false)
  }

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'All' || p.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roles: Array<ProjectRole | 'All'> = ['All', 'Owner', 'Admin', 'Reviewer', 'Viewer']

  if (authError) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-sm font-medium text-white hover:bg-violet-700 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New project
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  roleFilter === role
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-violet-300 hover:text-violet-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-4/5 mb-5" />
                <div className="border-t border-gray-100 pt-3 flex gap-4">
                  <div className="h-3 bg-gray-100 rounded w-16" />
                  <div className="h-3 bg-gray-100 rounded w-16" />
                  <div className="ml-auto h-3 bg-gray-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">
              {search || roleFilter !== 'All' ? 'No projects match your filters' : 'No projects yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {search || roleFilter !== 'All'
                ? 'Try adjusting your search or filter.'
                : 'Create your first project to get started.'}
            </p>
            {!search && roleFilter === 'All' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-5 px-4 py-2.5 rounded-xl bg-violet-600 text-sm font-medium text-white hover:bg-violet-700 transition shadow-sm"
              >
                New project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {showCreateForm && (
        <CreateProjectForm
          onSuccess={handleProjectCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  )
}

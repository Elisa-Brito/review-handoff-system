import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getProjectColor(id: string): string {
  const colors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-fuchsia-500',
    'bg-orange-500',
  ]
  const index = id.charCodeAt(0) % colors.length
  return colors[index]
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  const userEmail = user.email ?? ''
  const userFullName =
    user.user_metadata?.full_name ?? userEmail.split('@')[0] ?? 'User'
  const userInitials = getInitials(userFullName)

  type ProjectWithMeta = {
    id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
    created_by: string
    member_count: number
  }

  // Step 1: get project IDs the user belongs to
  const { data: memberRows } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)

  const projectIds = memberRows?.map((r: any) => r.project_id as string).filter(Boolean) ?? []

  let projects: ProjectWithMeta[] = []

  if (projectIds.length > 0) {
    // Step 2: fetch project details directly
    const { data: projectRows } = await supabase
      .from('projects')
      .select('id, name, description, created_at, updated_at, created_by')
      .in('id', projectIds)
      .order('updated_at', { ascending: false })

    // Step 3: count members per project
    const { data: memberCounts } = await supabase
      .from('project_members')
      .select('project_id')
      .in('project_id', projectIds)

    const countMap: Record<string, number> = {}
    for (const row of memberCounts ?? []) {
      const pid = (row as any).project_id as string
      countMap[pid] = (countMap[pid] ?? 0) + 1
    }

    projects = (projectRows ?? []).map((proj: any) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description ?? null,
      created_at: proj.created_at,
      updated_at: proj.updated_at,
      owner_id: proj.owner_id,
      member_count: countMap[proj.id] ?? 1,
    }))
  }

  const handleSignOut = async () => {
    'use server'
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const supabaseServer = await createServerClient()
    await supabaseServer.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className="text-gray-900 font-semibold text-base tracking-tight">
                Review &amp; Handoff
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* User avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-semibold select-none">
                  {userInitials}
                </div>
                <span className="text-sm text-gray-600 hidden sm:block">
                  {userFullName}
                </span>
              </div>

              {/* Sign out */}
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              {projects.length === 0
                ? 'No projects yet'
                : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Project
          </Link>
        </div>

        {/* Projects grid or empty state */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              No projects yet
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              Create your first project to start reviewing and handing off
              designs with your team.
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create a project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const colorClass = getProjectColor(project.id)
              const initial = project.name[0]?.toUpperCase() ?? 'P'
              const lastActivity = project.updated_at ?? project.created_at

              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-md transition-all duration-150 flex flex-col gap-4"
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center text-white font-bold text-base shrink-0`}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                        {project.name}
                      </h3>
                      {project.description ? (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {project.description}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5 italic">
                          No description
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                    {/* Member count */}
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                        />
                      </svg>
                      <span>
                        {project.member_count}{' '}
                        {project.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    {/* Last activity */}
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{formatRelativeTime(lastActivity)}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

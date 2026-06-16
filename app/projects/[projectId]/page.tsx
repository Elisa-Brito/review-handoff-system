import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'screens' | 'deployments' | 'members' | 'handoffs'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface Screen {
  id: string
  project_id: string
  name: string
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

interface Deployment {
  id: string
  project_id: string
  status: 'pending' | 'building' | 'ready' | 'error' | 'canceled'
  url: string | null
  version: string | null
  created_at: string
}

interface Member {
  id: string
  user_id: string
  project_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  created_at: string
  profiles: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface Handoff {
  id: string
  project_id: string
  generated_at: string
  download_url: string
  label: string | null
}

// ─── Supabase server client ───────────────────────────────────────────────────

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server component — cookie writes are ignored
          }
        },
      },
    }
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function DeploymentStatusBadge({ status }: { status: Deployment['status'] }) {
  const map: Record<Deployment['status'], { label: string; className: string }> = {
    pending:  { label: 'Pending',  className: 'bg-yellow-100 text-yellow-800' },
    building: { label: 'Building', className: 'bg-blue-100 text-blue-800' },
    ready:    { label: 'Ready',    className: 'bg-green-100 text-green-800' },
    error:    { label: 'Error',    className: 'bg-red-100 text-red-800' },
    canceled: { label: 'Canceled', className: 'bg-gray-100 text-gray-600' },
  }
  const { label, className } = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Member['role'] }) {
  const map: Record<Member['role'], string> = {
    owner:  'bg-purple-100 text-purple-800',
    admin:  'bg-indigo-100 text-indigo-800',
    editor: 'bg-sky-100 text-sky-800',
    viewer: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[role]}`}>
      {role}
    </span>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabNav({
  projectId,
  activeTab,
  counts,
}: {
  projectId: string
  activeTab: Tab
  counts: Record<Tab, number>
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'screens',     label: 'Screens' },
    { key: 'deployments', label: 'Deployments' },
    { key: 'members',     label: 'Members' },
    { key: 'handoffs',    label: 'Handoffs' },
  ]

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6" aria-label="Project tabs">
      {tabs.map(({ key, label }) => {
        const isActive = key === activeTab
        return (
          <Link
            key={key}
            href={`/projects/${projectId}?tab=${key}`}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {counts[key]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function ScreensPanel({ projectId, screens }: { projectId: string; screens: Screen[] }) {
  if (screens.length === 0) {
    return <p className="text-sm text-gray-500">No screens yet.</p>
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {screens.map((screen) => (
        <li key={screen.id}>
          <Link
            href={`/projects/${projectId}/review/${screen.id}`}
            className="group block rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden"
          >
            <div className="aspect-video bg-gray-50 flex items-center justify-center overflow-hidden">
              {screen.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={screen.thumbnail_url}
                  alt={screen.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <svg
                  className="h-10 w-10 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 3H5.25A2.25 2.25 0 003 5.25v4.5A2.25 2.25 0 005.25 12h4.5A2.25 2.25 0 0012 9.75v-4.5A2.25 2.25 0 009.75 3zm9 0h-4.5A2.25 2.25 0 0012 5.25v4.5A2.25 2.25 0 0014.25 12h4.5A2.25 2.25 0 0021 9.75v-4.5A2.25 2.25 0 0018.75 3zm-9 9H5.25A2.25 2.25 0 003 14.25v4.5A2.25 2.25 0 005.25 21h4.5A2.25 2.25 0 0012 18.75v-4.5A2.25 2.25 0 009.75 12zm9 0h-4.5A2.25 2.25 0 0012 14.25v4.5A2.25 2.25 0 0014.25 21h4.5A2.25 2.25 0 0021 18.75v-4.5A2.25 2.25 0 0018.75 12z"
                  />
                </svg>
              )}
            </div>
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                {screen.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {new Date(screen.updated_at).toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function DeploymentsPanel({ deployments }: { deployments: Deployment[] }) {
  if (deployments.length === 0) {
    return <p className="text-sm text-gray-500">No deployments yet.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Version</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">URL</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Deployed at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deployments.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <DeploymentStatusBadge status={d.status} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-700">
                {d.version ?? '—'}
              </td>
              <td className="px-4 py-3">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline truncate max-w-xs block"
                  >
                    {d.url}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {new Date(d.created_at).toLocaleString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MembersPanel({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-gray-500">No members yet.</p>
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {members.map((m) => {
        const initials = (m.profiles.full_name ?? m.profiles.email)
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            {m.profiles.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.profiles.avatar_url}
                alt={m.profiles.full_name ?? m.profiles.email}
                className="h-9 w-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 flex-shrink-0">
                {initials}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {m.profiles.full_name ?? m.profiles.email}
              </p>
              {m.profiles.full_name && (
                <p className="truncate text-xs text-gray-400">{m.profiles.email}</p>
              )}
            </div>
            <RoleBadge role={m.role} />
          </li>
        )
      })}
    </ul>
  )
}

function HandoffsPanel({ handoffs }: { handoffs: Handoff[] }) {
  if (handoffs.length === 0) {
    return <p className="text-sm text-gray-500">No handoffs generated yet.</p>
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {handoffs.map((h) => (
        <li key={h.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {h.label ?? `Handoff ${h.id.slice(0, 8)}`}
            </p>
            <p className="text-xs text-gray-400">
              Generated{' '}
              {new Date(h.generated_at).toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <a
            href={h.download_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </a>
        </li>
      ))}
    </ul>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { projectId: string }
  searchParams: { tab?: string }
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const supabase = createSupabaseServerClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { projectId } = params
  const rawTab = searchParams.tab ?? 'screens'
  const activeTab: Tab = ['screens', 'deployments', 'members', 'handoffs'].includes(rawTab)
    ? (rawTab as Tab)
    : 'screens'

  // Parallel data fetch
  const [
    { data: project, error: projectError },
    { data: screens },
    { data: deployments },
    { data: members },
    { data: handoffs },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, description, created_at, updated_at')
      .eq('id', projectId)
      .single<Project>(),

    supabase
      .from('screens')
      .select('id, project_id, name, thumbnail_url, created_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),

    supabase
      .from('deployments')
      .select('id, project_id, status, url, version, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),

    supabase
      .from('project_members')
      .select('id, user_id, project_id, role, created_at, profiles(full_name, email, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),

    supabase
      .from('handoffs')
      .select('id, project_id, generated_at, download_url, label')
      .eq('project_id', projectId)
      .order('generated_at', { ascending: false }),
  ])

  if (projectError || !project) {
    redirect('/projects')
  }

  const safeScreens     = (screens     ?? []) as Screen[]
  const safeDeployments = (deployments ?? []) as Deployment[]
  const safeMembers     = (members     ?? []) as Member[]
  const safeHandoffs    = (handoffs    ?? []) as Handoff[]

  const counts: Record<Tab, number> = {
    screens:     safeScreens.length,
    deployments: safeDeployments.length,
    members:     safeMembers.length,
    handoffs:    safeHandoffs.length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1" aria-label="Breadcrumb">
                <Link href="/projects" className="hover:text-gray-600 transition-colors">
                  Projects
                </Link>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-700 truncate">{project.name}</span>
              </nav>
              <h1 className="text-xl font-semibold text-gray-900 truncate">{project.name}</h1>
              {project.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
              )}
            </div>
            <dl className="hidden sm:flex gap-6 text-right flex-shrink-0">
              <div>
                <dt className="text-xs text-gray-400">Created</dt>
                <dd className="text-sm text-gray-700">
                  {new Date(project.created_at).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Updated</dt>
                <dd className="text-sm text-gray-700">
                  {new Date(project.updated_at).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <TabNav projectId={projectId} activeTab={activeTab} counts={counts} />

        {activeTab === 'screens' && (
          <ScreensPanel projectId={projectId} screens={safeScreens} />
        )}
        {activeTab === 'deployments' && (
          <DeploymentsPanel deployments={safeDeployments} />
        )}
        {activeTab === 'members' && (
          <MembersPanel members={safeMembers} />
        )}
        {activeTab === 'handoffs' && (
          <HandoffsPanel handoffs={safeHandoffs} />
        )}
      </main>
    </div>
  )
}

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'editor' | 'reviewer' | 'viewer'

export interface Screen {
  id: string
  name: string
  vercel_url: string | null
  thumbnail_url: string | null
  version: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  slug: string
}

export interface Deployment {
  id: string
  version: string
  url: string
  created_at: string
  is_current: boolean
}

export interface Comment {
  id: string
  body: string
  author_name: string
  created_at: string
}

export interface ThreadWithComments {
  id: string
  x_percent: number
  y_percent: number
  status: 'open' | 'resolved' | 'wip'
  comments: Comment[]
  created_at: string
}

type Tool = 'pointer' | 'comment'
type Panel = 'sidebar' | 'handoff' | 'history' | null

// ── Context ───────────────────────────────────────────────────────────────────

interface ReviewContextValue {
  threads: ThreadWithComments[]
  selectedThreadId: string | null
  activeTool: Tool
  activePanel: Panel
  userRole: UserRole
  selectThread: (id: string | null) => void
  setActiveTool: (tool: Tool) => void
  setActivePanel: (panel: Panel) => void
  addThread: (x: number, y: number) => void
  resolveThread: (id: string) => void
  addComment: (threadId: string, body: string) => void
}

const ReviewContext = createContext<ReviewContextValue | null>(null)

function useReview() {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReview must be used within ReviewProvider')
  return ctx
}

function ReviewProvider({
  children,
  initialThreads,
  userRole,
}: {
  children: React.ReactNode
  initialThreads: ThreadWithComments[]
  userRole: UserRole
}) {
  const [threads, setThreads] = useState<ThreadWithComments[]>(initialThreads)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('pointer')
  const [activePanel, setActivePanel] = useState<Panel>(null)

  const selectThread = useCallback((id: string | null) => {
    setSelectedThreadId(id)
    if (id) setActivePanel('sidebar')
  }, [])

  const addThread = useCallback((x: number, y: number) => {
    const thread: ThreadWithComments = {
      id: `thread-${Date.now()}`,
      x_percent: Math.max(0, Math.min(100, x)),
      y_percent: Math.max(0, Math.min(100, y)),
      status: 'open',
      comments: [],
      created_at: new Date().toISOString(),
    }
    setThreads((p) => [...p, thread])
    setSelectedThreadId(thread.id)
    setActivePanel('sidebar')
    setActiveTool('pointer')
  }, [])

  const resolveThread = useCallback((id: string) => {
    setThreads((p) =>
      p.map((t) => (t.id === id ? { ...t, status: 'resolved' as const } : t))
    )
  }, [])

  const addComment = useCallback((threadId: string, body: string) => {
    setThreads((p) =>
      p.map((t) =>
        t.id === threadId
          ? {
              ...t,
              comments: [
                ...t.comments,
                {
                  id: `comment-${Date.now()}`,
                  body,
                  author_name: 'You',
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : t
      )
    )
  }, [])

  const handleSetActivePanel = useCallback(
    (panel: Panel) => setActivePanel((p) => (p === panel ? null : panel)),
    []
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'Escape') { setSelectedThreadId(null); setActiveTool('pointer') }
      if (e.key === 'c') setActiveTool('comment')
      if (e.key === 'v') setActiveTool('pointer')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <ReviewContext.Provider value={{
      threads, selectedThreadId, activeTool, activePanel, userRole,
      selectThread, setActiveTool, setActivePanel: handleSetActivePanel,
      addThread, resolveThread, addComment,
    }}>
      {children}
    </ReviewContext.Provider>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────

function TopBar({ project, screen, deployments, selectedDeployment, onDeploymentChange }: {
  project: Project
  screen: Screen
  deployments: Deployment[]
  selectedDeployment: Deployment | null
  onDeploymentChange: (d: Deployment) => void
}) {
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 52, zIndex: 100,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {project.name}
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>/</span>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {screen.name}
        </span>
      </nav>

      {deployments.length > 0 && (
        <select
          value={selectedDeployment?.id ?? ''}
          onChange={(e) => { const d = deployments.find((x) => x.id === e.target.value); if (d) onDeploymentChange(d) }}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)',
            borderRadius: 7, color: 'rgba(255,255,255,0.8)', fontSize: 12, padding: '5px 10px',
            cursor: 'pointer', outline: 'none', flexShrink: 0,
          }}
        >
          {deployments.map((d) => (
            <option key={d.id} value={d.id} style={{ background: '#1a1a1a' }}>
              v{d.version}{d.is_current ? ' (current)' : ''}
            </option>
          ))}
        </select>
      )}

      <a href="/dashboard" style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
      }}>
        ←
      </a>
    </header>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(99,102,241,0.28)' : 'transparent',
        color: active ? '#a5b4fc' : 'rgba(255,255,255,0.55)',
        outline: active ? '1px solid rgba(99,102,241,0.45)' : 'none',
        transition: 'background 0.12s, color 0.12s', flexShrink: 0,
      }}
    >
      {icon}
    </button>
  )
}

function ReviewToolbar() {
  const { activeTool, setActiveTool, activePanel, setActivePanel, userRole } = useReview()
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 90,
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(16,16,18,0.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '5px 7px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    }}>
      <ToolBtn icon="↖" label="Select (V)" active={activeTool === 'pointer'} onClick={() => setActiveTool('pointer')} />
      {userRole !== 'viewer' && (
        <ToolBtn icon="💬" label="Comment (C)" active={activeTool === 'comment'} onClick={() => setActiveTool('comment')} />
      )}
      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 5px' }} />
      <ToolBtn icon="⚡" label="Handoff" active={activePanel === 'handoff'} onClick={() => setActivePanel('handoff')} />
      <ToolBtn icon="◷" label="History" active={activePanel === 'history'} onClick={() => setActivePanel('history')} />
      <ToolBtn icon="☰" label="Comments" active={activePanel === 'sidebar'} onClick={() => setActivePanel('sidebar')} />
    </div>
  )
}

// ── Comment Pins ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  open: '#6366f1',
  wip: '#f59e0b',
  resolved: '#10b981',
}

function CommentPin({ thread, isSelected, onSelect }: {
  thread: ThreadWithComments
  isSelected: boolean
  onSelect: () => void
}) {
  const color = STATUS_COLOR[thread.status] ?? '#6366f1'
  const size = isSelected ? 30 : 24
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      title={`${thread.comments.length} comment(s) — ${thread.status}`}
      style={{
        position: 'absolute',
        left: `${thread.x_percent}%`,
        top: `${thread.y_percent}%`,
        transform: 'translate(-50%,-100%)',
        width: size, height: size,
        borderRadius: '50% 50% 50% 0',
        background: color,
        border: isSelected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.4)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 10, fontWeight: 700, pointerEvents: 'all',
        boxShadow: isSelected ? `0 0 0 4px ${color}44, 0 4px 16px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.45)',
        transition: 'all 0.15s', zIndex: isSelected ? 30 : 20,
      }}
    >
      {thread.comments.length || '+'}
    </button>
  )
}

function CommentPins() {
  const { threads, selectedThreadId, selectThread, activeTool, addThread } = useReview()

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'comment') return
    const rect = e.currentTarget.getBoundingClientRect()
    addThread(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100)
  }, [activeTool, addThread])

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        pointerEvents: activeTool === 'comment' ? 'all' : 'none',
        cursor: activeTool === 'comment' ? 'crosshair' : 'default',
      }}
    >
      {threads.map((t) => (
        <CommentPin key={t.id} thread={t} isSelected={t.id === selectedThreadId} onSelect={() => selectThread(t.id)} />
      ))}
    </div>
  )
}

// ── Comment Sidebar ───────────────────────────────────────────────────────────

function CommentSidebar() {
  const { threads, selectedThreadId, selectThread, activePanel, resolveThread } = useReview()
  const isOpen = activePanel === 'sidebar'

  return (
    <aside style={{
      position: 'fixed', right: 0, top: 52, bottom: 0, width: 316,
      background: '#111113', borderLeft: '1px solid rgba(255,255,255,0.07)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)', zIndex: 80,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Comments</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 9px', borderRadius: 10 }}>
          {threads.filter((t) => t.status === 'open').length} open
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {threads.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.7 }}>
            Nenhum comentário ainda.<br />
            Pressione <kbd style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>C</kbd> e clique no protótipo.
          </div>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              onClick={() => selectThread(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && selectThread(t.id)}
              style={{
                margin: '3px 8px', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: t.id === selectedThreadId ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.028)',
                border: t.id === selectedThreadId ? '1px solid rgba(99,102,241,0.28)' : '1px solid rgba(255,255,255,0.055)',
                transition: 'all 0.13s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[t.status], flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flex: 1 }}>
                  {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {t.status !== 'resolved' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resolveThread(t.id) }}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.35)', background: 'transparent', color: '#34d399', cursor: 'pointer' }}
                  >
                    Resolver
                  </button>
                )}
              </div>
              {t.comments.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, margin: 0, fontStyle: 'italic' }}>Novo thread — sem comentários</p>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {t.comments[0].body}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

// ── Thread Panel (write comment) ──────────────────────────────────────────────

function ThreadPanel() {
  const { threads, selectedThreadId, selectThread, activePanel, resolveThread, addComment } = useReview()
  const thread = threads.find((t) => t.id === selectedThreadId)
  const [draft, setDraft] = useState('')

  if (!thread || activePanel !== 'sidebar') return null

  const submit = () => {
    if (!draft.trim()) return
    addComment(thread.id, draft.trim())
    setDraft('')
  }

  return (
    <div style={{
      position: 'fixed', right: 324, bottom: 72, width: 296, maxHeight: 440,
      background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
      boxShadow: '0 20px 60px rgba(0,0,0,0.75)', zIndex: 85,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[thread.status] }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Thread</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {thread.status !== 'resolved' && (
            <button onClick={() => resolveThread(thread.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.35)', background: 'transparent', color: '#34d399', cursor: 'pointer' }}>
              Resolver
            </button>
          )}
          <button onClick={() => selectThread(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {thread.comments.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, textAlign: 'center', margin: 0 }}>Sem comentários ainda</p>
        ) : (
          thread.comments.map((c) => (
            <div key={c.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {c.author_name.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600 }}>{c.author_name}</span>
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, marginLeft: 'auto' }}>
                  {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, margin: 0, paddingLeft: 30, lineHeight: 1.5 }}>{c.body}</p>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva um comentário… (⌘↵ para enviar)"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#fff', fontSize: 12, padding: '7px 10px', resize: 'none',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5,
          }}
        />
        <button
          disabled={!draft.trim()}
          onClick={submit}
          style={{
            marginTop: 6, width: '100%', padding: '7px 0', borderRadius: 8, border: 'none',
            background: draft.trim() ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: draft.trim() ? '#fff' : 'rgba(255,255,255,0.28)',
            fontSize: 12, fontWeight: 600, cursor: draft.trim() ? 'pointer' : 'default', transition: 'background 0.13s',
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

// ── Preview Area (iframe + pins overlay) ──────────────────────────────────────

function PreviewArea({ screen, previewUrl }: { screen: Screen; previewUrl: string | null }) {
  const { activeTool, activePanel } = useReview()
  const rightOpen = activePanel === 'sidebar'
  const leftOpen = activePanel === 'handoff' || activePanel === 'history'

  return (
    <div style={{
      position: 'fixed',
      top: 52,
      left: leftOpen ? 272 : 0,
      right: rightOpen ? 316 : 0,
      bottom: 0,
      background: '#0d0d0f',
      transition: 'left 0.24s cubic-bezier(0.4,0,0.2,1), right 0.24s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {/* Dot grid background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />

      {/* Comment mode tint */}
      {activeTool === 'comment' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.04)', border: '2px solid rgba(99,102,241,0.2)', pointerEvents: 'none', zIndex: 1 }} />
      )}

      {/* Comment mode hint */}
      {activeTool === 'comment' && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(99,102,241,0.9)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20, zIndex: 25, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          💬 Clique em qualquer lugar para adicionar um comentário
        </div>
      )}

      {/* Frame */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {previewUrl ? (
          <iframe
            src={previewUrl}
            style={{
              width: '100%', height: '100%', border: 'none', background: '#fff',
              // Disable iframe pointer events in comment mode so our overlay captures clicks
              pointerEvents: activeTool === 'comment' ? 'none' : 'auto',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={screen.name}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', gap: 12 }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
              <rect x={3} y={3} width={18} height={18} rx={2} />
              <circle cx={8.5} cy={8.5} r={1.5} />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div style={{ fontSize: 14 }}>Sem preview disponível</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.1)' }}>Adicione uma URL de deployment para ver o protótipo aqui</div>
          </div>
        )}

        {/* Pins overlay — always on top of iframe */}
        <CommentPins />
      </div>
    </div>
  )
}

// ── Main Canvas ───────────────────────────────────────────────────────────────

export interface ReviewCanvasProps {
  screenId: string
  projectId: string
  userRole: UserRole
  screen: Screen
  project: Project
  initialThreads: ThreadWithComments[]
  deployments: Deployment[]
}

export default function ReviewCanvas({ screenId, projectId, userRole, screen, project, initialThreads, deployments }: ReviewCanvasProps) {
  const currentDep = deployments.find((d) => d.is_current) ?? deployments[0] ?? null
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(currentDep)
  const previewUrl = selectedDeployment?.url ?? screen.vercel_url ?? null

  return (
    <ReviewProvider initialThreads={initialThreads} userRole={userRole}>
      <div style={{
        width: '100vw', height: '100vh', overflow: 'hidden', background: '#0d0d0f',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <TopBar project={project} screen={screen} deployments={deployments} selectedDeployment={selectedDeployment} onDeploymentChange={setSelectedDeployment} />
        <PreviewArea screen={screen} previewUrl={previewUrl} />
        <CommentSidebar />
        <ThreadPanel />
        <ReviewToolbar />
      </div>
    </ReviewProvider>
  )
}

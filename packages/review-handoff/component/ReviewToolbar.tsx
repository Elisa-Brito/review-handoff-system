'use client'

import { useState, useEffect, useCallback } from 'react'

const SUPABASE_URL = 'https://ikmtbhnfipatxecxpyfa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbXRiaG5maXBhdHhlY3hweWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTE3MzMsImV4cCI6MjA5NzE4NzczM30.Q95hSSGtJcm47xhN7Rn5fFJBvjB94oLjeC3uavLC-Ps'

type Pin = {
  id: string
  x_percent: number
  y_percent: number
  body: string
  author_name: string
  status: 'open' | 'resolved'
  created_at: string
}

async function sbFetch(path: string, opts: any = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || '',
      ...(opts.headers || {}),
    },
  })
  if (res.status === 204) return null
  return res.json()
}

async function getOrCreateReview(url: string) {
  const existing = await sbFetch(`reviews?url=eq.${encodeURIComponent(url)}&select=id&limit=1`)
  if (existing?.length > 0) return existing[0].id
  const created = await sbFetch('reviews?select=id', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ url }),
  })
  return created[0].id
}

export default function ReviewToolbar() {
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [mode, setMode] = useState<'pointer' | 'comment'>('pointer')
  const [panel, setPanel] = useState(false)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const url = (location.origin + location.pathname).replace(/\/+$/, '') || location.origin
    getOrCreateReview(url).then(async (id) => {
      setReviewId(id)
      const data = await sbFetch(`pins?review_id=eq.${id}&order=created_at.asc`)
      setPins(data ?? [])
    })
  }, [])

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'comment') return
    const x = (e.clientX / window.innerWidth) * 100
    const y = (e.clientY / window.innerHeight) * 100
    setPendingPos({ x, y })
    setPanel(true)
  }, [mode])

  const handleSave = async () => {
    if (!pendingPos || !body.trim() || !reviewId) return
    setSaving(true)
    const data = await sbFetch('pins?select=*', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        review_id: reviewId,
        x_percent: pendingPos.x,
        y_percent: pendingPos.y,
        body: body.trim(),
        author_name: 'Anônimo',
        status: 'open',
      }),
    })
    setPins(p => [...p, data[0]])
    setBody('')
    setPendingPos(null)
    setMode('pointer')
    setSaving(false)
  }

  const handleToggleStatus = async (pin: Pin) => {
    const next = pin.status === 'open' ? 'resolved' : 'open'
    await sbFetch(`pins?id=eq.${pin.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ status: next }),
    })
    setPins(p => p.map(p2 => p2.id === pin.id ? { ...p2, status: next } : p2))
  }

  const s = styles

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleOverlayClick}
        style={{
          ...s.overlay,
          pointerEvents: mode === 'comment' ? 'all' : 'none',
          cursor: mode === 'comment' ? 'crosshair' : 'default',
        }}
      />

      {/* Pins */}
      {pins.map((pin, i) => (
        <div
          key={pin.id}
          onClick={() => { setPanel(true) }}
          style={{
            ...s.pin,
            left: `calc(${pin.x_percent}% - 14px)`,
            top: `calc(${pin.y_percent}% - 14px)`,
            background: pin.status === 'resolved' ? '#22c55e' : '#6366f1',
          }}
        >
          <span style={s.pinNum}>{i + 1}</span>
        </div>
      ))}

      {/* Panel */}
      {panel && (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Comentários</span>
            <button onClick={() => { setPanel(false); setPendingPos(null); setBody('') }} style={s.closeBtn}>✕</button>
          </div>

          <div style={s.pinsList}>
            {pins.length === 0 && !pendingPos && (
              <p style={s.empty}>Nenhum comentário ainda.<br />Ative o modo comentário e clique na tela.</p>
            )}
            {pins.map((pin, i) => (
              <div key={pin.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={{ ...s.badge, background: pin.status === 'resolved' ? '#22c55e' : '#6366f1' }}>{i + 1}</div>
                  <span style={s.author}>{pin.author_name}</span>
                  {pin.status === 'resolved' && <span style={{ ...s.author, marginLeft: 'auto', color: '#22c55e' }}>✓ resolvido</span>}
                </div>
                <p style={s.cardBody}>{pin.body}</p>
                <button onClick={() => handleToggleStatus(pin)} style={s.statusBtn}>
                  {pin.status === 'open' ? 'Marcar resolvido' : 'Reabrir'}
                </button>
              </div>
            ))}

            {pendingPos && (
              <div style={s.card}>
                <p style={{ ...s.author, marginBottom: 8 }}>Novo comentário</p>
                <textarea
                  autoFocus
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Digite seu comentário…"
                  rows={3}
                  style={s.textarea}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setPendingPos(null); setBody(''); setMode('pointer') }} style={s.cancelBtn}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving || !body.trim()} style={s.saveBtn}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button
          onClick={() => setMode(m => m === 'comment' ? 'pointer' : 'comment')}
          style={{ ...s.toolBtn, ...(mode === 'comment' ? s.toolBtnActive : {}) }}
        >
          💬 Comentar
        </button>
        <div style={s.divider} />
        <button
          onClick={() => setPanel(p => !p)}
          style={{ ...s.toolBtn, ...(panel ? s.toolBtnActive : {}) }}
        >
          ☰ Threads {pins.length > 0 && `(${pins.filter(p => p.status === 'open').length})`}
        </button>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2147483640 },
  pin: {
    position: 'fixed', width: 28, height: 28, borderRadius: '50% 50% 50% 0',
    border: '2px solid #fff', transform: 'rotate(-45deg)', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2147483641,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pinNum: { transform: 'rotate(45deg)', color: '#fff', fontSize: 11, fontWeight: 700 },
  panel: {
    position: 'fixed', top: 0, right: 0, width: 320, height: '100vh',
    background: '#18181b', borderLeft: '1px solid rgba(255,255,255,0.08)',
    zIndex: 2147483645, display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
  },
  panelHeader: {
    padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center',
  },
  panelTitle: { color: '#fff', fontSize: 14, fontWeight: 600, flex: 1 },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16 },
  pinsList: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '32px 0', lineHeight: 1.6 },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 12,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { width: 20, height: 20, borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  author: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  cardBody: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5, margin: 0 },
  statusBtn: { marginTop: 8, fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: 10, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  cancelBtn: { flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' },
  saveBtn: { flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  toolbar: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    zIndex: 2147483646, display: 'flex', alignItems: 'center', gap: 4,
    background: '#1c1c1f', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '6px 10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  toolBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: 'none', background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  toolBtnActive: { background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' },
  divider: { width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' },
}

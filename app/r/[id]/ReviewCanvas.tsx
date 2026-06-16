'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Pin {
  id: string
  x_percent: number
  y_percent: number
  body: string
  author_name: string
  status: 'open' | 'resolved'
  created_at: string
}

interface Review {
  id: string
  url: string
}

type Panel = 'comments' | 'handoff' | null

interface HandoffData {
  colors: { name: string; hex: string; usage: string }[]
  typography: { name: string; fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string; usage: string }[]
  spacing: { name: string; value: string; usage: string }[]
  components: { name: string; description: string; props: string[]; cssSnippet: string }[]
  summary: string
}

export default function ReviewCanvas({ review, initialPins }: { review: Review; initialPins: Pin[] }) {
  const [pins, setPins] = useState<Pin[]>(initialPins)
  const [mode, setMode] = useState<'pointer' | 'comment'>('pointer')
  const [panel, setPanel] = useState<Panel>(null)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [form, setForm] = useState({ name: '', body: '' })
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [manualRoutes, setManualRoutes] = useState([{ name: '', path: '' }])
  const [handoffData, setHandoffData] = useState<HandoffData | null>(null)
  const [handoffScreenshot, setHandoffScreenshot] = useState<string | null>(null)
  const [handoffHistory, setHandoffHistory] = useState<{ id: string; created_at: string; pages_analyzed: string[]; data: HandoffData; screenshot: string | null }[]>([])
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffHistoryLoading, setHandoffHistoryLoading] = useState(false)
  const [handoffError, setHandoffError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMode('pointer'); setPendingPos(null); setSelectedPin(null) }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        setMode('comment')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'comment') return
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPos({ x, y })
    setSelectedPin(null)
  }

  const handleSave = async () => {
    if (!form.body.trim() || !pendingPos) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x_percent: pendingPos.x, y_percent: pendingPos.y, body: form.body, author_name: form.name }),
      })
      const data = await res.json()
      if (res.ok) {
        setPins(prev => [...prev, data])
        setPendingPos(null)
        setForm(f => ({ ...f, body: '' }))
        setMode('pointer')
        setPanel('comments')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (pin: Pin) => {
    const next = pin.status === 'open' ? 'resolved' : 'open'
    const { error } = await supabase
      .from('pins')
      .update({ status: next })
      .eq('id', pin.id)
    if (!error) {
      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, status: next } : p))
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePanel = async (p: Panel) => {
    setPanel(prev => prev === p ? null : p)
    if (p === 'handoff' && handoffHistory.length === 0) {
      setHandoffHistoryLoading(true)
      try {
        const res = await fetch(`/api/handoff?reviewId=${review.id}`)
        const data = await res.json()
        setHandoffHistory(data)
        if (data.length > 0 && !handoffData) {
          setHandoffData(data[0].data)
          setHandoffScreenshot(data[0].screenshot)
        }
      } finally {
        setHandoffHistoryLoading(false)
      }
    }
  }

  const handleGenerateHandoff = async () => {
    setHandoffLoading(true)
    setHandoffError('')
    try {
      const validRoutes = manualRoutes.filter(r => r.path.trim())
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vercelUrl: review.url,
          reviewId: review.id,
          repoUrl: repoUrl.trim() || undefined,
          manualRoutes: validRoutes.length > 0 ? validRoutes : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar handoff')
      setHandoffData(data.handoff)
      setHandoffScreenshot(data.screenshot)
      if (data.id) {
        setHandoffHistory(prev => [{ id: data.id, created_at: data.created_at, pages_analyzed: [], data: data.handoff, screenshot: data.screenshot }, ...prev])
      }
    } catch (err: any) {
      setHandoffError(err.message)
    } finally {
      setHandoffLoading(false)
    }
  }

  const openPins = pins.filter(p => p.status === 'open')
  const resolvedPins = pins.filter(p => p.status === 'resolved')

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#0d0d0f', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Main canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe
          src={review.url}
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: mode === 'comment' ? 'none' : 'auto' }}
        />

        {/* Overlay */}
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          style={{ position: 'absolute', inset: 0, pointerEvents: mode === 'comment' ? 'all' : 'none', cursor: mode === 'comment' ? 'crosshair' : 'default' }}
        >
          {/* Pins */}
          {pins.map((pin, i) => (
            <div
              key={pin.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPin(selectedPin === pin.id ? null : pin.id)
                setPendingPos(null)
              }}
              title={`${pin.author_name || 'Anônimo'}: ${pin.body}`}
              style={{
                position: 'absolute',
                left: `${pin.x_percent}%`,
                top: `${pin.y_percent}%`,
                transform: 'translate(-50%, -50%)',
                width: 26, height: 26,
                borderRadius: selectedPin === pin.id ? '50%' : '50% 50% 50% 0',
                background: pin.status === 'resolved' ? '#22c55e' : selectedPin === pin.id ? '#6366f1' : '#f59e0b',
                color: '#fff', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', pointerEvents: 'all',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.9)',
                transition: 'all 0.15s',
                zIndex: 5,
                opacity: pin.status === 'resolved' ? 0.6 : 1,
              }}
            >
              {i + 1}
            </div>
          ))}

          {/* Pending pin */}
          {pendingPos && (
            <>
              <div style={{
                position: 'absolute',
                left: `${pendingPos.x}%`,
                top: `${pendingPos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 26, height: 26, borderRadius: '50%',
                background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.9)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                zIndex: 6,
              }}>
                {pins.length + 1}
              </div>
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${Math.min(pendingPos.x, 65)}%`,
                  top: `${pendingPos.y}%`,
                  transform: 'translate(20px, -50%)',
                  background: '#1e1e2e',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: 16, width: 280,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  zIndex: 10,
                }}
              >
                <input
                  placeholder="Seu nome (opcional)"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                />
                <textarea
                  placeholder="Adicione um comentário…"
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: 10 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.body.trim()}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: saving || !form.body.trim() ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || !form.body.trim() ? 'not-allowed' : 'pointer' }}
                  >
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setPendingPos(null)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>⌘↵ para salvar</p>
              </div>
            </>
          )}

          {/* Selected pin tooltip (only when panel is closed) */}
          {selectedPin && !pendingPos && !panel && (() => {
            const p = pins.find(x => x.id === selectedPin)
            if (!p) return null
            return (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${Math.min(p.x_percent, 65)}%`,
                  top: `${p.y_percent}%`,
                  transform: 'translate(20px, -50%)',
                  background: '#1e1e2e',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: 16, width: 260,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  zIndex: 10, pointerEvents: 'all',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{p.author_name || 'Anônimo'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {p.body}
                </p>
                <button
                  onClick={() => handleToggleStatus(p)}
                  style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: p.status === 'open' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', color: p.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}
                >
                  {p.status === 'open' ? '✓ Marcar como resolvido' : '↩ Reabrir'}
                </button>
              </div>
            )
          })()}
        </div>

        {/* Mode hint */}
        {mode === 'comment' && (
          <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(99,102,241,0.92)', color: '#fff', fontSize: 13, fontWeight: 500, padding: '9px 20px', borderRadius: 24, pointerEvents: 'none', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
            Clique em qualquer lugar para comentar · Esc para sair
          </div>
        )}

        {/* Bottom toolbar */}
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(18,18,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '7px 10px', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
          <a href="/" title="Início" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>
            ←
          </a>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

          <button
            onClick={() => { setMode(m => m === 'comment' ? 'pointer' : 'comment'); setPendingPos(null) }}
            title="Comentar (C)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: mode === 'comment' ? '#6366f1' : 'rgba(255,255,255,0.08)',
              color: mode === 'comment' ? '#fff' : 'rgba(255,255,255,0.7)',
              transition: 'all 0.15s',
            }}
          >
            <span>✏️</span>
            <span>{mode === 'comment' ? 'Comentando' : 'Comentar'}</span>
          </button>

          <button
            onClick={() => togglePanel('comments')}
            title="Ver comentários"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: panel === 'comments' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
              color: panel === 'comments' ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
              transition: 'all 0.15s',
            }}
          >
            <span>💬</span>
            <span>Threads {pins.length > 0 && <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>{openPins.length}</span>}</span>
          </button>

          <button
            onClick={() => togglePanel('handoff')}
            title="Handoff"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: panel === 'handoff' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
              color: panel === 'handoff' ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
              transition: 'all 0.15s',
            }}
          >
            <span>📋</span>
            <span>Handoff</span>
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

          <button
            onClick={handleCopy}
            title="Copia o link desta review — cole em qualquer lugar para voltar com os comentários"
            style={{ padding: '6px 12px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: copied ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.08)', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s' }}
          >
            {copied ? '✓ Link copiado' : '🔗 Copiar link da review'}
          </button>
        </div>
      </div>

      {/* Right panel */}
      {panel && (
        <div style={{ width: 320, background: '#13131a', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Panel header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {panel === 'comments' ? '💬 Comentários' : '📋 Handoff'}
            </span>
            <button onClick={() => setPanel(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {panel === 'comments' && (
              <>
                {pins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    Nenhum comentário ainda.<br />Clique em <strong>Comentar</strong> para começar.
                  </div>
                ) : (
                  <>
                    {/* Open */}
                    {openPins.length > 0 && (
                      <>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 8px' }}>
                          Abertos · {openPins.length}
                        </p>
                        {openPins.map((pin, i) => (
                          <PinCard
                            key={pin.id}
                            pin={pin}
                            index={pins.indexOf(pin)}
                            selected={selectedPin === pin.id}
                            onSelect={() => { setSelectedPin(selectedPin === pin.id ? null : pin.id) }}
                            onToggle={() => handleToggleStatus(pin)}
                          />
                        ))}
                      </>
                    )}

                    {/* Resolved */}
                    {resolvedPins.length > 0 && (
                      <>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 8px' }}>
                          Resolvidos · {resolvedPins.length}
                        </p>
                        {resolvedPins.map((pin) => (
                          <PinCard
                            key={pin.id}
                            pin={pin}
                            index={pins.indexOf(pin)}
                            selected={selectedPin === pin.id}
                            onSelect={() => { setSelectedPin(selectedPin === pin.id ? null : pin.id) }}
                            onToggle={() => handleToggleStatus(pin)}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {panel === 'handoff' && (
              <>
                {handoffHistoryLoading && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    Carregando histórico…
                  </div>
                )}
                {!handoffData ? (
                  <div style={{ padding: '8px 4px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                      Gere um handoff completo analisando o protótipo com IA — cores, tipografia, espaçamento e componentes.
                    </p>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Repositório GitHub (opcional)
                    </label>
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={e => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
                    />

                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Páginas do projeto (opcional)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {manualRoutes.map((route, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6 }}>
                          <input
                            placeholder="Nome (ex: Dashboard)"
                            value={route.name}
                            onChange={e => setManualRoutes(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }}
                          />
                          <input
                            placeholder="/rota"
                            value={route.path}
                            onChange={e => setManualRoutes(prev => prev.map((r, j) => j === i ? { ...r, path: e.target.value } : r))}
                            style={{ width: 90, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }}
                          />
                          {manualRoutes.length > 1 && (
                            <button
                              onClick={() => setManualRoutes(prev => prev.filter((_, j) => j !== i))}
                              style={{ width: 28, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setManualRoutes(prev => [...prev, { name: '', path: '' }])}
                      style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}
                    >
                      + Adicionar página
                    </button>
                    {handoffError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12, marginBottom: 12 }}>
                        {handoffError}
                      </div>
                    )}
                    <button
                      onClick={handleGenerateHandoff}
                      disabled={handoffLoading}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: handoffLoading ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: handoffLoading ? 'not-allowed' : 'pointer' }}
                    >
                      {handoffLoading ? '✨ Analisando com IA…' : '✨ Gerar Handoff'}
                    </button>
                    {handoffLoading && (
                      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                        Isso pode levar 20–40 segundos…
                      </p>
                    )}
                  </div>
                ) : handoffData ? (
                  <div>
                    {handoffScreenshot && (
                      <img src={handoffScreenshot} alt="Screenshot" style={{ width: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)' }} />
                    )}

                    {/* Summary */}
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{handoffData.summary}</p>
                    </div>

                    {/* Colors */}
                    {handoffData.colors?.length > 0 && (
                      <HandoffSection title="🎨 Cores">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {handoffData.colors.map((c, i) => (
                            <div key={i} title={c.usage} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}
                              onClick={() => navigator.clipboard.writeText(c.hex)}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, background: c.hex, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                              <div>
                                <div style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{c.hex}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </HandoffSection>
                    )}

                    {/* Typography */}
                    {handoffData.typography?.length > 0 && (
                      <HandoffSection title="✏️ Tipografia">
                        {handoffData.typography.map((t, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{t.fontFamily} · {t.fontSize} · {t.fontWeight}</div>
                            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>{t.usage}</div>
                          </div>
                        ))}
                      </HandoffSection>
                    )}

                    {/* Spacing */}
                    {handoffData.spacing?.length > 0 && (
                      <HandoffSection title="📐 Espaçamento">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {handoffData.spacing.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' }}>
                              <div style={{ width: s.value.includes('px') ? Math.min(parseInt(s.value), 48) : 24, height: 8, background: 'rgba(99,102,241,0.5)', borderRadius: 2, flexShrink: 0 }} />
                              <div>
                                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{s.name}</span>
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}> · {s.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </HandoffSection>
                    )}

                    {/* Components */}
                    {handoffData.components?.length > 0 && (
                      <HandoffSection title="🧩 Componentes">
                        {handoffData.components.map((c, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px', marginBottom: 8 }}>
                            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>{c.description}</div>
                            {c.props?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                                {c.props.map((p, j) => (
                                  <span key={j} style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontSize: 10, borderRadius: 4, padding: '2px 6px' }}>{p}</span>
                                ))}
                              </div>
                            )}
                            {c.cssSnippet && (
                              <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 8px', color: '#a5b4fc', fontSize: 10, margin: 0, overflow: 'auto', cursor: 'pointer' }}
                                onClick={() => navigator.clipboard.writeText(c.cssSnippet)}
                                title="Clique para copiar"
                              >{c.cssSnippet}</pre>
                            )}
                          </div>
                        ))}
                      </HandoffSection>
                    )}

                    {handoffHistory.length > 1 && (
                      <div style={{ marginTop: 16, marginBottom: 4 }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Histórico</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {handoffHistory.map((h, i) => (
                            <button
                              key={h.id}
                              onClick={() => { setHandoffData(h.data); setHandoffScreenshot(h.screenshot) }}
                              style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: `1px solid ${h.data === handoffData ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.07)'}`, background: h.data === handoffData ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', color: h.data === handoffData ? '#a5b4fc' : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}
                            >
                              {i === 0 ? '● ' : '○ '}
                              {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setHandoffData(null)}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
                    >
                      ↺ Gerar novamente
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HandoffSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{title}</p>
      {children}
    </div>
  )
}

function PinCard({ pin, index, selected, onSelect, onToggle }: {
  pin: Pin
  index: number
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50% 50% 50% 0', flexShrink: 0, marginTop: 1,
          background: pin.status === 'resolved' ? '#22c55e' : '#f59e0b',
          color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: pin.status === 'resolved' ? 0.7 : 1,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: pin.status === 'resolved' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}>
              {pin.author_name || 'Anônimo'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
              {new Date(pin.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <p style={{ color: pin.status === 'resolved' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.65)', fontSize: 12, margin: '0 0 10px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {pin.body}
          </p>
          <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: pin.status === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              color: pin.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)',
            }}
          >
            {pin.status === 'open' ? '✓ Resolver' : '↩ Reabrir'}
          </button>
        </div>
      </div>
    </div>
  )
}

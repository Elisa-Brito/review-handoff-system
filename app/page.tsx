'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro inesperado')
      window.location.href = `/r/${data.id}`
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Also handle /r/[id] URLs pasted directly — redirect straight there
  const handleUrlChange = (val: string) => {
    setUrl(val)
    setError('')
    try {
      const u = new URL(val.trim())
      const match = u.pathname.match(/^\/r\/([0-9a-f-]{36})$/)
      if (match) window.location.href = `/r/${match[1]}`
    } catch {}
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 24,
          }}>
            💬
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>
            Review de Protótipos
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, margin: 0 }}>
            Cole a URL do Vercel e comece a comentar direto na tela
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://meu-app.vercel.app"
            required
            autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
              color: '#fff', fontSize: 16, padding: '14px 16px',
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.7)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
          />

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              padding: '14px 0', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 600,
              background: loading || !url.trim() ? 'rgba(99,102,241,0.3)' : '#6366f1',
              color: loading || !url.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
            }}
          >
            {loading ? 'Abrindo…' : 'Abrir Review →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 32 }}>
          A mesma URL sempre abre a mesma review com todos os comentários salvos
        </p>
      </div>
    </div>
  )
}

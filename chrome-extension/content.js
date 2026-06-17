const SUPABASE_URL = 'https://ikmtbhnfipatxecxpyfa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbXRiaG5maXBhdHhlY3hweWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTE3MzMsImV4cCI6MjA5NzE4NzczM30.Q95hSSGtJcm47xhN7Rn5fFJBvjB94oLjeC3uavLC-Ps'

const pageUrl = location.origin + location.pathname

let reviewId = null
let pins = []
let mode = 'pointer'
let pendingPos = null
let panelOpen = false

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.text()
    throw new Error(err)
  }
  if (res.status === 204) return null
  return res.json()
}

async function getOrCreateReview() {
  const normalized = pageUrl.replace(/\/+$/, '') || pageUrl
  const existing = await sbFetch(`reviews?url=eq.${encodeURIComponent(normalized)}&select=id&limit=1`)
  if (existing && existing.length > 0) return existing[0].id
  const created = await sbFetch('reviews?select=id', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ url: normalized }),
  })
  return created[0].id
}

async function loadPins() {
  if (!reviewId) return
  const data = await sbFetch(`pins?review_id=eq.${reviewId}&order=created_at.asc`)
  pins = data || []
  renderPins()
  renderPinsList()
}

async function savePin(xPct, yPct, body, authorName) {
  const data = await sbFetch('pins?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({
      review_id: reviewId,
      x_percent: xPct,
      y_percent: yPct,
      body: body.trim(),
      author_name: authorName || 'Anônimo',
      status: 'open',
    }),
  })
  pins.push(data[0])
  renderPins()
  renderPinsList()
}

async function toggleStatus(pinId, current) {
  const next = current === 'open' ? 'resolved' : 'open'
  await sbFetch(`pins?id=eq.${pinId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ status: next }),
  })
  const pin = pins.find(p => p.id === pinId)
  if (pin) pin.status = next
  renderPins()
  renderPinsList()
}

function renderPins() {
  document.querySelectorAll('.rh-pin').forEach(el => el.remove())
  pins.forEach((pin, i) => {
    const el = document.createElement('div')
    el.className = 'rh-pin' + (pin.status === 'resolved' ? ' rh-resolved' : '')
    el.style.left = `calc(${pin.x_percent}% - 14px)`
    el.style.top = `calc(${pin.y_percent}% - 14px)`
    el.innerHTML = `<div class="rh-pin-number">${i + 1}</div>`
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      openPanel()
      setTimeout(() => {
        const card = document.getElementById(`rh-card-${pin.id}`)
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    })
    document.body.appendChild(el)
  })
}

function renderPinsList() {
  const list = document.getElementById('rh-pins-list')
  if (!list) return
  if (pins.length === 0) {
    list.innerHTML = '<div id="rh-empty">Nenhum comentário ainda.<br>Ative o modo comentário e clique na tela.</div>'
    return
  }
  list.innerHTML = pins.map((pin, i) => `
    <div class="rh-pin-card" id="rh-card-${pin.id}">
      <div class="rh-pin-card-header">
        <div class="rh-pin-badge ${pin.status === 'resolved' ? 'resolved' : ''}">${i + 1}</div>
        <span class="rh-pin-author">${pin.author_name || 'Anônimo'}</span>
        <span class="rh-pin-author" style="margin-left:auto">${pin.status === 'resolved' ? '✓ resolvido' : ''}</span>
      </div>
      <div class="rh-pin-body">${pin.body}</div>
      <button class="rh-status-btn" data-id="${pin.id}" data-status="${pin.status}">
        ${pin.status === 'open' ? 'Marcar resolvido' : 'Reabrir'}
      </button>
    </div>
  `).join('')

  list.querySelectorAll('.rh-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleStatus(btn.dataset.id, btn.dataset.status)
    })
  })
}

function openPanel() {
  panelOpen = true
  const panel = document.getElementById('rh-panel')
  if (panel) panel.classList.add('rh-open')
  updateToolbar()
}

function closePanel() {
  panelOpen = false
  const panel = document.getElementById('rh-panel')
  if (panel) panel.classList.remove('rh-open')
  cancelComment()
  updateToolbar()
}

function showCommentForm(xPct, yPct) {
  pendingPos = { xPct, yPct }
  openPanel()
  const form = document.getElementById('rh-comment-form')
  if (form) {
    form.style.display = 'block'
    const ta = form.querySelector('textarea')
    if (ta) { ta.value = ''; ta.focus() }
  }
}

function cancelComment() {
  pendingPos = null
  const form = document.getElementById('rh-comment-form')
  if (form) form.style.display = 'none'
}

function setMode(m) {
  mode = m
  const overlay = document.getElementById('rh-overlay')
  if (overlay) overlay.classList.toggle('rh-active', m === 'comment')
  updateToolbar()
  if (m !== 'comment') cancelComment()
}

function updateToolbar() {
  const btnComment = document.getElementById('rh-btn-comment')
  const btnThreads = document.getElementById('rh-btn-threads')
  if (btnComment) btnComment.classList.toggle('rh-active', mode === 'comment')
  if (btnThreads) btnThreads.classList.toggle('rh-active', panelOpen)
}

function buildUI() {
  if (document.getElementById('rh-toolbar')) return

  // Overlay
  const overlay = document.createElement('div')
  overlay.id = 'rh-overlay'
  overlay.addEventListener('click', (e) => {
    if (mode !== 'comment') return
    const xPct = (e.clientX / window.innerWidth) * 100
    const yPct = (e.clientY / window.innerHeight) * 100
    showCommentForm(xPct, yPct)
  })
  document.body.appendChild(overlay)

  // Panel
  const panel = document.createElement('div')
  panel.id = 'rh-panel'
  panel.innerHTML = `
    <div id="rh-panel-header">
      <h2>Comentários</h2>
      <button id="rh-panel-close">✕</button>
    </div>
    <div id="rh-pins-list"></div>
    <div id="rh-comment-form" style="display:none">
      <textarea rows="3" placeholder="Digite seu comentário…"></textarea>
      <div id="rh-comment-form-actions">
        <button class="rh-btn-cancel" id="rh-cancel-btn">Cancelar</button>
        <button class="rh-btn-save" id="rh-save-btn">Salvar</button>
      </div>
    </div>
  `
  document.body.appendChild(panel)

  panel.querySelector('#rh-panel-close').addEventListener('click', closePanel)
  panel.querySelector('#rh-cancel-btn').addEventListener('click', () => {
    cancelComment()
    setMode('pointer')
  })
  panel.querySelector('#rh-save-btn').addEventListener('click', async () => {
    if (!pendingPos) return
    const ta = panel.querySelector('textarea')
    const body = ta.value.trim()
    if (!body) return
    const btn = panel.querySelector('#rh-save-btn')
    btn.disabled = true
    btn.textContent = 'Salvando…'
    await savePin(pendingPos.xPct, pendingPos.yPct, body, 'Anônimo')
    cancelComment()
    setMode('pointer')
    btn.disabled = false
    btn.textContent = 'Salvar'
  })

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.id = 'rh-toolbar'
  toolbar.innerHTML = `
    <button class="rh-tool-btn" id="rh-btn-comment">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Comentar
    </button>
    <div class="rh-divider"></div>
    <button class="rh-tool-btn" id="rh-btn-threads">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
      Threads
    </button>
  `
  document.body.appendChild(toolbar)

  toolbar.querySelector('#rh-btn-comment').addEventListener('click', () => {
    setMode(mode === 'comment' ? 'pointer' : 'comment')
  })
  toolbar.querySelector('#rh-btn-threads').addEventListener('click', () => {
    panelOpen ? closePanel() : openPanel()
  })

  renderPinsList()
}

async function init() {
  try {
    reviewId = await getOrCreateReview()
    await loadPins()
    buildUI()
  } catch (e) {
    console.error('[Review Extension]', e)
  }
}

// Only activate on message from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE') {
    const toolbar = document.getElementById('rh-toolbar')
    if (toolbar) {
      toolbar.style.display = toolbar.style.display === 'none' ? 'flex' : 'none'
      const panel = document.getElementById('rh-panel')
      if (toolbar.style.display === 'none' && panel) panel.classList.remove('rh-open')
    } else {
      init()
    }
  }
})

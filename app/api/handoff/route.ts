import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function fetchPageHTML(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
    })
    return await res.text()
  } catch {
    return ''
  }
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  const links = new Set<string>()
  const hrefRegex = /href=["']([^"'#?]+)["']/gi
  let m
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1]?.trim()
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    try {
      const full = new URL(href, baseUrl).href
      if (full.startsWith(origin) && !full.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|woff|woff2|js|css|ts)$/i)) {
        links.add(full)
      }
    } catch { /* skip */ }
  }
  return [...links]
}

async function discoverRoutesFromRepo(repoUrl: string, baseUrl: string): Promise<string[]> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/)
    if (!match) return []
    const [, owner, repo] = match
    const origin = new URL(baseUrl).origin

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { cache: 'no-store' })
    const tree = await treeRes.json()
    const files: string[] = (tree.tree ?? []).map((f: any) => f.path)

    const routes: string[] = [origin + '/']

    for (const file of files) {
      // app router: app/**/page.tsx → route
      const appMatch = file.match(/^(?:src\/)?app(\/.*?)\/page\.[jt]sx?$/)
      if (appMatch) {
        let route = appMatch[1]
          .replace(/\/\([^)]+\)/g, '') // remove (groups)
          .replace(/\/\[.*?\]/g, '')    // remove [dynamic] segments
        if (route === '') route = '/'
        routes.push(origin + route)
        continue
      }

      // pages router: pages/**/index.tsx or pages/foo.tsx → route
      const pagesMatch = file.match(/^(?:src\/)?pages(\/.*?)\.[jt]sx?$/)
      if (pagesMatch) {
        let route = pagesMatch[1]
          .replace(/\/index$/, '/')
          .replace(/\/\[.*?\]/g, '')
        if (!route.startsWith('/')) route = '/' + route
        if (!route.includes('_app') && !route.includes('_document') && !route.includes('api/')) {
          routes.push(origin + route)
        }
      }
    }

    return [...new Set(routes)]
  } catch {
    return []
  }
}

async function discoverRoutes(rootUrl: string): Promise<string[]> {
  const origin = new URL(rootUrl).origin
  const routes = new Set<string>([rootUrl])

  // 1. Try sitemap.xml
  try {
    const sitemapRes = await fetch(`${origin}/sitemap.xml`, { cache: 'no-store' })
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text()
      const locRegex = /<loc>([^<]+)<\/loc>/g
      let m
      while ((m = locRegex.exec(xml)) !== null) {
        const url = m[1].trim()
        if (url.startsWith(origin)) routes.add(url)
      }
    }
  } catch { /* skip */ }

  // 2. Try Next.js pages manifest
  try {
    const manifestRes = await fetch(`${origin}/_next/static/development/_buildManifest.js`, { cache: 'no-store' })
    if (!manifestRes.ok) {
      // Try production manifest
      const htmlRes = await fetch(rootUrl, { cache: 'no-store' })
      const html = await htmlRes.text()
      const buildIdMatch = html.match(/"buildId":"([^"]+)"/)
      if (buildIdMatch) {
        const manifestRes2 = await fetch(`${origin}/_next/static/${buildIdMatch[1]}/_buildManifest.js`, { cache: 'no-store' })
        if (manifestRes2.ok) {
          const js = await manifestRes2.text()
          const routeRegex = /"(\/[^"]*?)"/g
          let m
          while ((m = routeRegex.exec(js)) !== null) {
            const route = m[1]
            if (!route.includes('[') && !route.includes('_next')) {
              routes.add(`${origin}${route}`)
            }
          }
        }
      }
    } else {
      const js = await manifestRes.text()
      const routeRegex = /"(\/[^"]*?)"/g
      let m
      while ((m = routeRegex.exec(js)) !== null) {
        const route = m[1]
        if (!route.includes('[') && !route.includes('_next')) {
          routes.add(`${origin}${route}`)
        }
      }
    }
  } catch { /* skip */ }

  return [...routes]
}

async function crawlSite(rootUrl: string, maxPages = 10, extraRoutes: string[] = []): Promise<{ url: string; html: string }[]> {
  const visited = new Set<string>()
  const pages: { url: string; html: string }[] = []

  // Discover routes from sitemap/manifest + repo + HTML links
  const discovered = await discoverRoutes(rootUrl)
  const queue = [...new Set([rootUrl, ...extraRoutes, ...discovered])]

  for (const url of queue) {
    if (pages.length >= maxPages) break
    if (url.match(/\.(js|css|ts|json|xml|txt|map)$/i)) continue
    const normalized = url.split('?')[0].replace(/\/$/, '') || url
    if (visited.has(normalized)) continue
    visited.add(normalized)

    const html = await fetchPageHTML(url)
    if (!html || !html.trim().startsWith('<') ) continue
    pages.push({ url, html })

    // Also follow links found in HTML
    const links = extractInternalLinks(html, url)
    for (const link of links) {
      const norm = link.split('?')[0].replace(/\/$/, '') || link
      if (!visited.has(norm) && !queue.includes(link)) {
        queue.push(link)
      }
    }
  }

  return pages
}

async function fetchCSSFiles(html: string, baseUrl: string): Promise<string> {
  const cssUrls: string[] = []
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    cssUrls.push(href.startsWith('http') ? href : new URL(href, baseUrl).href)
  }

  const contents: string[] = []
  for (const cssUrl of cssUrls.slice(0, 8)) {
    try {
      const res = await fetch(cssUrl, { cache: 'no-store' })
      const text = await res.text()
      contents.push(text.slice(0, 20000))
    } catch { /* skip */ }
  }

  // Also extract inline styles
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  while ((match = styleRegex.exec(html)) !== null) {
    contents.push(match[1])
  }

  return contents.join('\n')
}

function extractColors(css: string, html: string): { name: string; hex: string; usage: string }[] {
  const colorMap = new Map<string, number>()

  // Match hex colors
  const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
  let m
  while ((m = hexRegex.exec(css + html)) !== null) {
    const hex = m[0].toLowerCase()
    // Skip pure white, near-white, pure black
    if (['#ffffff', '#fff', '#000000', '#000'].includes(hex)) continue
    colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1)
  }

  // Match rgb/rgba
  const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g
  while ((m = rgbRegex.exec(css)) !== null) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3])
    if (r === 255 && g === 255 && b === 255) continue
    if (r === 0 && g === 0 && b === 0) continue
    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
    colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1)
  }

  // Match CSS variables with color values
  const varColorRegex = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6}|rgb[^;]+)/g
  while ((m = varColorRegex.exec(css)) !== null) {
    const varName = m[1]
    const val = m[2].trim()
    if (val.startsWith('#')) {
      colorMap.set(val.toLowerCase(), (colorMap.get(val.toLowerCase()) ?? 0) + 3)
    }
  }

  const sorted = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  return sorted.map(([hex]) => ({
    name: guessColorName(hex),
    hex,
    usage: guessColorUsage(hex, css),
  }))
}

function guessColorName(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const max = Math.max(r, g, b)
  if (max < 60) return 'Dark'
  if (r > 200 && g < 100 && b < 100) return 'Red'
  if (r > 200 && g > 150 && b < 100) return 'Orange'
  if (r > 200 && g > 200 && b < 100) return 'Yellow'
  if (r < 100 && g > 150 && b < 100) return 'Green'
  if (r < 100 && g > 150 && b > 150) return 'Teal'
  if (r < 100 && g < 100 && b > 150) return 'Blue'
  if (r > 100 && g < 100 && b > 150) return 'Purple'
  if (r > 150 && g < 100 && b > 100) return 'Pink'
  if (r > 150 && g > 150 && b > 150) return 'Light Gray'
  if (r > 80 && g > 80 && b > 80) return 'Gray'
  return 'Color'
}

function guessColorUsage(hex: string, css: string): string {
  const usages: string[] = []
  const escaped = hex.replace('#', '\\#')
  if (new RegExp(`background[^:]*:\\s*${escaped}`, 'i').test(css)) usages.push('background')
  if (new RegExp(`color:\\s*${escaped}`, 'i').test(css)) usages.push('text')
  if (new RegExp(`border[^:]*:\\s*[^;]*${escaped}`, 'i').test(css)) usages.push('border')
  return usages.length > 0 ? usages.join(', ') : 'accent'
}

function extractTypography(css: string): { name: string; fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string; usage: string }[] {
  const results: { name: string; fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string; usage: string }[] = []
  const seen = new Set<string>()

  // Find font families
  const fontFamilyRegex = /font-family\s*:\s*([^;}{]+)/gi
  const families = new Set<string>()
  let m
  while ((m = fontFamilyRegex.exec(css)) !== null) {
    const f = m[1].trim().split(',')[0].replace(/["']/g, '').trim()
    if (f && !f.includes('inherit') && !f.includes('system-ui')) families.add(f)
  }

  // Font size scale
  const sizeRegex = /font-size\s*:\s*([\d.]+(?:px|rem|em|pt))/gi
  const sizes = new Map<string, number>()
  while ((m = sizeRegex.exec(css)) !== null) {
    const s = m[1]
    sizes.set(s, (sizes.get(s) ?? 0) + 1)
  }

  const topSizes = [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s)

  const family = [...families][0] ?? 'Inter, sans-serif'

  const scale = [
    { name: 'Display', size: topSizes[0] ?? '2.25rem', weight: '700', lh: '1.2', usage: 'Títulos principais' },
    { name: 'Heading', size: topSizes[1] ?? '1.5rem', weight: '600', lh: '1.3', usage: 'Subtítulos e seções' },
    { name: 'Body', size: topSizes[2] ?? '1rem', weight: '400', lh: '1.5', usage: 'Texto corrido' },
    { name: 'Small', size: topSizes[3] ?? '0.875rem', weight: '400', lh: '1.4', usage: 'Labels e captions' },
  ]

  for (const s of scale) {
    const key = `${s.name}-${s.size}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({ name: s.name, fontFamily: family, fontSize: s.size, fontWeight: s.weight, lineHeight: s.lh, usage: s.usage })
    }
  }

  return results
}

function extractSpacing(css: string): { name: string; value: string; usage: string }[] {
  const spacingMap = new Map<string, number>()

  const spacingRegex = /(?:padding|margin|gap|space)[^:]*:\s*([\d.]+(?:px|rem|em))/gi
  let m
  while ((m = spacingRegex.exec(css)) !== null) {
    const v = m[1]
    spacingMap.set(v, (spacingMap.get(v) ?? 0) + 1)
  }

  const sorted = [...spacingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const labels = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
  return sorted
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([val], i) => ({
      name: labels[i] ?? `space-${i + 1}`,
      value: val,
      usage: i === 0 ? 'Espaços internos pequenos' : i < 3 ? 'Padding de componentes' : 'Espaço entre seções',
    }))
}

function extractComponents(html: string, css: string): { name: string; description: string; props: string[]; cssSnippet: string }[] {
  const components: { name: string; description: string; props: string[]; cssSnippet: string }[] = []

  const componentPatterns = [
    { pattern: /class=["'][^"']*(?:btn|button)[^"']*["']/i, name: 'Button', desc: 'Botão de ação', props: ['variant', 'size', 'disabled'], css: '.btn {\n  padding: 0.5rem 1rem;\n  border-radius: 0.375rem;\n  font-weight: 600;\n  cursor: pointer;\n}' },
    { pattern: /class=["'][^"']*(?:card)[^"']*["']/i, name: 'Card', desc: 'Container de conteúdo', props: ['padding', 'shadow', 'border'], css: '.card {\n  border-radius: 0.5rem;\n  padding: 1.5rem;\n  background: white;\n  box-shadow: 0 1px 3px rgba(0,0,0,0.1);\n}' },
    { pattern: /class=["'][^"']*(?:input|form-control)[^"']*["']/i, name: 'Input', desc: 'Campo de formulário', props: ['type', 'placeholder', 'disabled', 'error'], css: '.input {\n  width: 100%;\n  padding: 0.5rem 0.75rem;\n  border: 1px solid #d1d5db;\n  border-radius: 0.375rem;\n}' },
    { pattern: /class=["'][^"']*(?:badge|tag|chip)[^"']*["']/i, name: 'Badge', desc: 'Indicador de status', props: ['variant', 'color'], css: '.badge {\n  display: inline-flex;\n  padding: 0.125rem 0.5rem;\n  border-radius: 9999px;\n  font-size: 0.75rem;\n  font-weight: 500;\n}' },
    { pattern: /class=["'][^"']*(?:nav|navbar|header)[^"']*["']/i, name: 'Navbar', desc: 'Barra de navegação', props: ['sticky', 'transparent'], css: '.navbar {\n  display: flex;\n  align-items: center;\n  padding: 0 1.5rem;\n  height: 64px;\n}' },
    { pattern: /class=["'][^"']*(?:modal|dialog)[^"']*["']/i, name: 'Modal', desc: 'Caixa de diálogo', props: ['open', 'onClose', 'size'], css: '.modal {\n  position: fixed;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}' },
    { pattern: /class=["'][^"']*(?:avatar)[^"']*["']/i, name: 'Avatar', desc: 'Foto ou inicial do usuário', props: ['src', 'size', 'fallback'], css: '.avatar {\n  width: 2.5rem;\n  height: 2.5rem;\n  border-radius: 50%;\n  object-fit: cover;\n}' },
    { pattern: /class=["'][^"']*(?:table)[^"']*["']/i, name: 'Table', desc: 'Tabela de dados', props: ['striped', 'bordered', 'hoverable'], css: '.table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 0.875rem;\n}' },
  ]

  for (const { pattern, name, desc, props, css: snippet } of componentPatterns) {
    if (pattern.test(html)) {
      components.push({ name, description: desc, props, cssSnippet: snippet })
    }
  }

  if (components.length === 0) {
    components.push(
      { name: 'Button', description: 'Botão de ação principal', props: ['variant', 'size', 'disabled'], cssSnippet: '.btn {\n  padding: 0.5rem 1.25rem;\n  border-radius: 0.375rem;\n  font-weight: 600;\n}' },
      { name: 'Card', description: 'Container de conteúdo com borda', props: ['padding', 'shadow'], cssSnippet: '.card {\n  border-radius: 0.75rem;\n  padding: 1.5rem;\n  box-shadow: 0 1px 3px rgba(0,0,0,0.1);\n}' },
    )
  }

  return components.slice(0, 6)
}

async function getScreenshotBase64(url: string): Promise<string | null> {
  try {
    const screenshotUrl = `https://image.thum.io/get/width/1280/crop/900/png/${url}`
    const res = await fetch(screenshotUrl, { cache: 'no-store' })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  } catch {
    return null
  }
}

async function fetchRepoFiles(repoUrl: string): Promise<string> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/)
    if (!match) return ''
    const [, owner, repo] = match

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { cache: 'no-store' })
    const tree = await treeRes.json()
    const files: string[] = (tree.tree ?? []).map((f: any) => f.path)

    const interesting = files.filter((f: string) =>
      /\.(css|scss|ts|tsx|js|jsx|json)$/.test(f) &&
      !f.includes('node_modules') && !f.includes('.next') && !f.includes('dist') &&
      (f.includes('tailwind') || f.includes('global') || f.includes('theme') ||
       f.includes('token') || f.includes('color') || f.includes('variable') ||
       f.endsWith('package.json') || /components?\//i.test(f))
    ).slice(0, 12)

    const contents: string[] = []
    for (const file of interesting) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`, { cache: 'no-store' })
        const text = await res.text()
        contents.push(`\n/* === ${file} === */\n${text.slice(0, 4000)}`)
      } catch { /* skip */ }
    }
    return contents.join('\n')
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  try {
    const { vercelUrl, repoUrl, manualRoutes, reviewId } = await req.json()
    if (!vercelUrl) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

    const origin = new URL(vercelUrl).origin
    const manualUrls = (manualRoutes ?? [])
      .filter((r: any) => r.path?.trim())
      .map((r: any) => origin + (r.path.startsWith('/') ? r.path : '/' + r.path))

    const repoRoutes = repoUrl?.trim() ? await discoverRoutesFromRepo(repoUrl.trim(), vercelUrl) : []
    const extraRoutes = [...new Set([...manualUrls, ...repoRoutes])]

    const [pages, repoContent] = await Promise.all([
      crawlSite(vercelUrl, 10, extraRoutes),
      repoUrl?.trim() ? fetchRepoFiles(repoUrl.trim()) : Promise.resolve(''),
    ])

    // Analyze each page individually
    const pagesAnalyzed = await Promise.all(pages.map(async (p) => {
      const css = await fetchCSSFiles(p.html, p.url)
      const fullCss = css + '\n' + repoContent
      const slug = new URL(p.url).pathname.replace(/\//g, ' ').trim() || 'Home'
      return {
        url: p.url,
        label: slug.charAt(0).toUpperCase() + slug.slice(1) || 'Home',
        colors: extractColors(fullCss, p.html),
        typography: extractTypography(fullCss),
        spacing: extractSpacing(fullCss),
        components: extractComponents(p.html, fullCss),
      }
    }))

    // Global deduped colors/typography across all pages
    const allCss = pagesAnalyzed.map(p => p.colors.map(c => c.hex).join(' ')).join(' ')
    const seenHex = new Set<string>()
    const globalColors = pagesAnalyzed.flatMap(p => p.colors).filter(c => {
      if (seenHex.has(c.hex)) return false
      seenHex.add(c.hex)
      return true
    }).slice(0, 12)

    const handoff = {
      pages: pagesAnalyzed,
      colors: globalColors,
      typography: pagesAnalyzed[0]?.typography ?? [],
      spacing: pagesAnalyzed[0]?.spacing ?? [],
      components: [...new Map(pagesAnalyzed.flatMap(p => p.components).map(c => [c.name, c])).values()].slice(0, 6),
      summary: `Analisadas ${pages.length} página${pages.length !== 1 ? 's' : ''}: ${pagesAnalyzed.map(p => p.label).join(', ')}.${repoUrl ? ' Inclui dados do repositório.' : ''}`,
    }

    // Save to DB
    const supabase = getSupabase()
    const { data: saved } = await supabase
      .from('handoffs')
      .insert({
        review_id: reviewId,
        data: handoff,
        pages_analyzed: pages.map(p => p.url),
      })
      .select('id, created_at')
      .single()

    return NextResponse.json({
      id: saved?.id,
      handoff,
      created_at: saved?.created_at,
    }, { headers: CORS })
  } catch (err: any) {
    console.error('handoff error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400, headers: CORS })

  const supabase = getSupabase()
  await supabase.from('handoffs').delete().eq('id', id)
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const reviewId = searchParams.get('reviewId')
  if (!reviewId) return NextResponse.json([], { status: 200 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('handoffs')
    .select('id, created_at, pages_analyzed, data, screenshot')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [], { headers: CORS })
}

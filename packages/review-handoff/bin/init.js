#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const CDN_URL = 'https://review-handoff-system.vercel.app/review-toolbar.js'

if (process.argv[2] === 'remove') {
  require('./remove.js')
  process.exit(0)
}

console.log('\n🔍 Review Handoff Plugin\n')

// ── Detect project type and inject ───────────────────────────────────────────

// 1. Vite / CRA / plain HTML — has index.html at root
const viteHtml = path.join(cwd, 'index.html')
if (fs.existsSync(viteHtml)) {
  injectHtml(viteHtml)
  process.exit(0)
}

// 2. Next.js App Router — has app/layout.tsx|jsx
const nextLayouts = [
  path.join(cwd, 'app', 'layout.tsx'),
  path.join(cwd, 'app', 'layout.jsx'),
  path.join(cwd, 'src', 'app', 'layout.tsx'),
  path.join(cwd, 'src', 'app', 'layout.jsx'),
]
const nextLayout = nextLayouts.find(p => fs.existsSync(p))
if (nextLayout) {
  injectNextLayout(nextLayout)
  process.exit(0)
}

// 3. Next.js Pages Router — has pages/_document.tsx|jsx
const nextDocs = [
  path.join(cwd, 'pages', '_document.tsx'),
  path.join(cwd, 'pages', '_document.jsx'),
  path.join(cwd, 'src', 'pages', '_document.tsx'),
  path.join(cwd, 'src', 'pages', '_document.jsx'),
]
const nextDoc = nextDocs.find(p => fs.existsSync(p))
if (nextDoc) {
  injectNextDocument(nextDoc)
  process.exit(0)
}

// 4. CRA / other — public/index.html
const publicHtml = path.join(cwd, 'public', 'index.html')
if (fs.existsSync(publicHtml)) {
  injectHtml(publicHtml)
  process.exit(0)
}

// 5. Fallback — print manual instructions
console.log('⚠️  Não foi possível detectar o projeto automaticamente.')
console.log('   Adicione manualmente antes do </body> no HTML principal:\n')
console.log(`   <script src="${CDN_URL}"></script>\n`)
printDone()

// ── Injection helpers ─────────────────────────────────────────────────────────

function injectHtml(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf-8')
  const tag = `<script src="${CDN_URL}"></script>`

  if (html.includes(CDN_URL)) {
    console.log(`✓ Já instalado em ${rel(htmlPath)}`)
    printDone(); return
  }

  // Replace any old local reference
  html = html.replace(/<script[^>]*review-toolbar\.js[^>]*><\/script>/g, tag)

  if (!html.includes(CDN_URL)) {
    html = html.replace('</body>', `  ${tag}\n</body>`)
  }

  fs.writeFileSync(htmlPath, html, 'utf-8')
  console.log(`✓ Script injetado em ${rel(htmlPath)}`)
  printDone()
}

function injectNextLayout(layoutPath) {
  let src = fs.readFileSync(layoutPath, 'utf-8')
  const tag = `<script src="${CDN_URL}"></script>`

  if (src.includes(CDN_URL)) {
    console.log(`✓ Já instalado em ${rel(layoutPath)}`)
    printDone(); return
  }

  // Remove old component-style injection if present
  if (src.includes('ReviewToolbar')) {
    src = src.replace(/import ReviewToolbar from ['"][^'"]+['"]\n?/g, '')
    src = src.replace(/[ \t]*<ReviewToolbar\s*\/>\n?/g, '')
  }
  // Remove any old script tag for review-toolbar
  src = src.replace(/[ \t]*<script[^>]*review-toolbar[^>]*\/?>\s*(<\/script>)?\n?/g, '')

  // Inject before </body>
  if (src.includes('</body>')) {
    src = src.replace('</body>', `        ${tag}\n      </body>`)
  } else {
    console.log(`⚠️  Não encontrei </body> em ${rel(layoutPath)}. Adicione manualmente:\n   ${tag}\n`)
    printDone(); return
  }

  fs.writeFileSync(layoutPath, src, 'utf-8')
  console.log(`✓ Script injetado em ${rel(layoutPath)}`)
  printDone()
}

function injectNextDocument(docPath) {
  let src = fs.readFileSync(docPath, 'utf-8')
  const tag = `<script src="${CDN_URL}"></script>`

  if (src.includes(CDN_URL)) {
    console.log(`✓ Já instalado em ${rel(docPath)}`)
    printDone(); return
  }

  // Inject before </body> or </Body>
  if (src.includes('</Body>')) {
    src = src.replace('</Body>', `          ${tag}\n        </Body>`)
  } else if (src.includes('</body>')) {
    src = src.replace('</body>', `          ${tag}\n        </body>`)
  } else {
    console.log(`⚠️  Não encontrei </Body> em ${rel(docPath)}. Adicione manualmente:\n   ${tag}\n`)
    printDone(); return
  }

  fs.writeFileSync(docPath, src, 'utf-8')
  console.log(`✓ Script injetado em ${rel(docPath)}`)
  printDone()
}

function rel(p) { return p.replace(cwd, '.') }

function printDone() {
  console.log('\n✅ Pronto! Faça o deploy e compartilhe o link.\n')
}

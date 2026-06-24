#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const CDN_URL = 'https://review-handoff-system.vercel.app/review-toolbar.js'
const SCRIPT_TAG = `<script src="${CDN_URL}"></script>`

if (process.argv[2] === 'remove') {
  require('./remove.js')
  process.exit(0)
}

console.log('\n🔍 Review Handoff — iniciando setup...\n')

// Detecta tipo de projeto
const isNextJs = fs.existsSync(path.join(cwd, 'next.config.js')) ||
  fs.existsSync(path.join(cwd, 'next.config.mjs')) ||
  fs.existsSync(path.join(cwd, 'next.config.ts'))

if (isNextJs) {
  setupNextJs()
} else {
  setupHtml()
}

function setupNextJs() {
  console.log('✓ Projeto Next.js detectado\n')

  const srcDir = path.join(__dirname, '..', 'component')

  // Copia componente React
  const destDir = path.join(cwd, 'components')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(path.join(srcDir, 'ReviewToolbar.tsx'), path.join(destDir, 'ReviewToolbar.tsx'))
  console.log('✓ Componente copiado → components/ReviewToolbar.tsx')

  // Injeta no layout
  const layoutPaths = [
    path.join(cwd, 'app', 'layout.tsx'),
    path.join(cwd, 'app', 'layout.jsx'),
    path.join(cwd, 'src', 'app', 'layout.tsx'),
    path.join(cwd, 'src', 'app', 'layout.jsx'),
  ]
  const layoutPath = layoutPaths.find(p => fs.existsSync(p))

  if (!layoutPath) {
    console.log('\n⚠️  Não encontrei app/layout.tsx. Adicione manualmente:\n')
    console.log("   import ReviewToolbar from '@/components/ReviewToolbar'")
    console.log('   // dentro do <body>:')
    console.log('   <ReviewToolbar />\n')
    printDone()
    return
  }

  let layout = fs.readFileSync(layoutPath, 'utf-8')
  if (layout.includes('ReviewToolbar')) {
    console.log('✓ ReviewToolbar já está no layout.')
    printDone()
    return
  }

  const firstImport = layout.indexOf('import ')
  layout = layout.slice(0, firstImport) +
    "import ReviewToolbar from '@/components/ReviewToolbar'\n" +
    layout.slice(firstImport)
  layout = layout.replace('</body>', '      <ReviewToolbar />\n      </body>')

  fs.writeFileSync(layoutPath, layout, 'utf-8')
  console.log(`✓ ReviewToolbar injetado em ${layoutPath.replace(cwd, '.')}`)
  printDone()
}

function setupHtml() {
  // Tenta injetar via CDN em index.html automaticamente
  const htmlPaths = [
    path.join(cwd, 'index.html'),
    path.join(cwd, 'public', 'index.html'),
    path.join(cwd, 'src', 'index.html'),
  ]
  const htmlPath = htmlPaths.find(p => fs.existsSync(p))

  if (htmlPath) {
    let html = fs.readFileSync(htmlPath, 'utf-8')
    if (html.includes('review-handoff-plugin') || html.includes('review-toolbar.js')) {
      // Atualiza tag antiga (arquivo local) para CDN
      html = html.replace(/<script[^>]*review-toolbar\.js[^>]*><\/script>/g, SCRIPT_TAG)
      fs.writeFileSync(htmlPath, html, 'utf-8')
      console.log(`✓ Script atualizado para CDN em ${htmlPath.replace(cwd, '.')}`)
    } else {
      html = html.replace('</body>', `  ${SCRIPT_TAG}\n</body>`)
      fs.writeFileSync(htmlPath, html, 'utf-8')
      console.log(`✓ Script CDN injetado em ${htmlPath.replace(cwd, '.')}`)
    }
  } else {
    console.log('⚠️  Adicione manualmente antes do </body> em todos os HTMLs:\n')
    console.log(`   ${SCRIPT_TAG}\n`)
  }

  printDone()
}

function printDone() {
  console.log('\n✅ Pronto! O plugin carrega sempre a versão mais recente via CDN.')
  console.log('   Faça o deploy normalmente e compartilhe o link.\n')
}

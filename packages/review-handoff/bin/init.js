#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const CDN_URL = 'https://review-handoff-system.vercel.app/review-toolbar.js'
const SCRIPT_TAG = `<script src="${CDN_URL}"></script>`
const SCRIPT_TAG_JSX = `<script src="${CDN_URL}" />`

if (process.argv[2] === 'remove') {
  require('./remove.js')
  process.exit(0)
}

console.log('\n🔍 Review Handoff — iniciando setup...\n')

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

  // Injeta CDN script tag no layout (não copia componente local)
  const layoutPaths = [
    path.join(cwd, 'app', 'layout.tsx'),
    path.join(cwd, 'app', 'layout.jsx'),
    path.join(cwd, 'src', 'app', 'layout.tsx'),
    path.join(cwd, 'src', 'app', 'layout.jsx'),
  ]
  const layoutPath = layoutPaths.find(p => fs.existsSync(p))

  if (!layoutPath) {
    console.log('\n⚠️  Não encontrei app/layout.tsx. Adicione manualmente antes do </body>:\n')
    console.log(`   ${SCRIPT_TAG_JSX}\n`)
    printDone()
    return
  }

  let layout = fs.readFileSync(layoutPath, 'utf-8')

  // Já tem CDN → nada a fazer
  if (layout.includes('review-handoff-system.vercel.app')) {
    console.log('✓ Script CDN já está no layout.')
    printDone()
    return
  }

  // Tem versão antiga (componente ou outro script) → substituir
  if (layout.includes('ReviewToolbar') || layout.includes('review-toolbar')) {
    layout = layout.replace(/import ReviewToolbar from ['"][^'"]+['"]\n?/g, '')
    layout = layout.replace(/\s*<ReviewToolbar\s*\/>\n?/g, '')
    layout = layout.replace(/<script[^>]*review-toolbar[^>]*\/?>\s*(<\/script>)?/g, '')
    console.log('✓ Versão antiga removida do layout')
  }

  // Injeta CDN antes do </body>
  if (layout.includes('</body>')) {
    layout = layout.replace('</body>', `      ${SCRIPT_TAG_JSX}\n      </body>`)
  } else {
    // Fallback: injeta antes do fechamento do componente raiz
    layout = layout.replace(/(<\/[A-Za-z]+>\s*\)[\s\n]*;?\s*$)/, `      ${SCRIPT_TAG_JSX}\n$1`)
  }

  fs.writeFileSync(layoutPath, layout, 'utf-8')
  console.log(`✓ Script CDN injetado em ${layoutPath.replace(cwd, '.')}`)
  printDone()
}

function setupHtml() {
  const htmlPaths = [
    path.join(cwd, 'index.html'),
    path.join(cwd, 'public', 'index.html'),
    path.join(cwd, 'src', 'index.html'),
  ]
  const htmlPath = htmlPaths.find(p => fs.existsSync(p))

  if (htmlPath) {
    let html = fs.readFileSync(htmlPath, 'utf-8')

    if (html.includes('review-handoff-system.vercel.app')) {
      console.log('✓ Script CDN já está no HTML.')
      printDone()
      return
    }

    if (html.includes('review-toolbar.js') || html.includes('review-handoff-plugin')) {
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

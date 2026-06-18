#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()

if (process.argv[2] === 'remove') {
  require('./remove.js')
  process.exit(0)
}

console.log('\n🔍 Review Handoff — iniciando setup...\n')

const srcDir = path.join(__dirname, '..', 'component')

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
  // Copia o script JS puro
  const destPath = path.join(cwd, 'review-toolbar.js')
  fs.copyFileSync(path.join(srcDir, 'review-toolbar.js'), destPath)
  console.log('✓ Script copiado → review-toolbar.js\n')

  // Tenta injetar em index.html automaticamente
  const htmlPaths = [
    path.join(cwd, 'index.html'),
    path.join(cwd, 'public', 'index.html'),
    path.join(cwd, 'src', 'index.html'),
  ]
  const htmlPath = htmlPaths.find(p => fs.existsSync(p))

  if (htmlPath) {
    let html = fs.readFileSync(htmlPath, 'utf-8')
    if (!html.includes('review-toolbar.js')) {
      html = html.replace('</body>', '  <script src="/review-toolbar.js"></script>\n</body>')
      fs.writeFileSync(htmlPath, html, 'utf-8')
      console.log(`✓ Script injetado em ${htmlPath.replace(cwd, '.')}`)
    } else {
      console.log('✓ Script já está no HTML.')
    }
  } else {
    console.log('⚠️  Adicione manualmente antes do </body> em todos os HTMLs:\n')
    console.log('   <script src="/review-toolbar.js"></script>\n')
  }

  printDone()
}

function printDone() {
  console.log('\n✅ Pronto! Qualquer pessoa que abrir o protótipo vai ver a toolbar de comentários.')
  console.log('   Faça o deploy normalmente e compartilhe o link.\n')
}

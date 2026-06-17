#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()

console.log('\n🔍 Review Handoff — iniciando setup...\n')

// 1. Copia o componente
const srcComponent = path.join(__dirname, '..', 'component', 'ReviewToolbar.tsx')
const destDir = path.join(cwd, 'components')
const destComponent = path.join(destDir, 'ReviewToolbar.tsx')

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(srcComponent, destComponent)
console.log('✓ Componente copiado → components/ReviewToolbar.tsx')

// 2. Injeta no layout.tsx
const layoutPaths = [
  path.join(cwd, 'app', 'layout.tsx'),
  path.join(cwd, 'app', 'layout.jsx'),
  path.join(cwd, 'src', 'app', 'layout.tsx'),
  path.join(cwd, 'src', 'app', 'layout.jsx'),
]

const layoutPath = layoutPaths.find(p => fs.existsSync(p))

if (!layoutPath) {
  console.log('\n⚠️  Não encontrei app/layout.tsx automaticamente.')
  console.log('   Adicione manualmente no seu layout:\n')
  console.log("   import ReviewToolbar from '@/components/ReviewToolbar'")
  console.log('   // dentro do <body>:')
  console.log('   <ReviewToolbar />\n')
  process.exit(0)
}

let layout = fs.readFileSync(layoutPath, 'utf-8')

if (layout.includes('ReviewToolbar')) {
  console.log('✓ ReviewToolbar já está no layout — nada a fazer.')
  printDone()
  process.exit(0)
}

// Adiciona import
const firstImport = layout.indexOf('import ')
layout = layout.slice(0, firstImport) +
  "import ReviewToolbar from '@/components/ReviewToolbar'\n" +
  layout.slice(firstImport)

// Injeta antes de </body>
layout = layout.replace('</body>', '      <ReviewToolbar />\n      </body>')

fs.writeFileSync(layoutPath, layout, 'utf-8')
console.log(`✓ ReviewToolbar injetado em ${layoutPath.replace(cwd, '.')}`)

printDone()

function printDone() {
  console.log('\n✅ Pronto! Qualquer pessoa que abrir o protótipo vai ver a toolbar de comentários.')
  console.log('   Faça o deploy normalmente (vercel --prod) e compartilhe o link.\n')
}

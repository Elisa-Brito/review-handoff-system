#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()

console.log('\n🗑️  Review Handoff — removendo plugin...\n')

const isNextJs = fs.existsSync(path.join(cwd, 'next.config.js')) ||
  fs.existsSync(path.join(cwd, 'next.config.mjs')) ||
  fs.existsSync(path.join(cwd, 'next.config.ts'))

if (isNextJs) {
  removeNextJs()
} else {
  removeHtml()
}

function removeNextJs() {
  console.log('✓ Projeto Next.js detectado\n')

  // Remove componente
  const componentPath = path.join(cwd, 'components', 'ReviewToolbar.tsx')
  if (fs.existsSync(componentPath)) {
    fs.unlinkSync(componentPath)
    console.log('✓ components/ReviewToolbar.tsx removido')
  } else {
    console.log('⚠️  components/ReviewToolbar.tsx não encontrado')
  }

  // Remove do layout
  const layoutPaths = [
    path.join(cwd, 'app', 'layout.tsx'),
    path.join(cwd, 'app', 'layout.jsx'),
    path.join(cwd, 'src', 'app', 'layout.tsx'),
    path.join(cwd, 'src', 'app', 'layout.jsx'),
  ]
  const layoutPath = layoutPaths.find(p => fs.existsSync(p))

  if (layoutPath) {
    let layout = fs.readFileSync(layoutPath, 'utf-8')
    if (layout.includes('ReviewToolbar')) {
      layout = layout.replace(/import ReviewToolbar from ['"]@\/components\/ReviewToolbar['"]\n?/g, '')
      layout = layout.replace(/\s*<ReviewToolbar \/>\n?/g, '')
      fs.writeFileSync(layoutPath, layout, 'utf-8')
      console.log(`✓ ReviewToolbar removido de ${layoutPath.replace(cwd, '.')}`)
    } else {
      console.log('⚠️  ReviewToolbar não encontrado no layout')
    }
  }

  printDone()
}

function removeHtml() {
  // Remove arquivo local se existir (versões antigas)
  const scriptPath = path.join(cwd, 'review-toolbar.js')
  const scriptPathPublic = path.join(cwd, 'public', 'review-toolbar.js')
  if (fs.existsSync(scriptPath)) { fs.unlinkSync(scriptPath); console.log('✓ review-toolbar.js removido') }
  if (fs.existsSync(scriptPathPublic)) { fs.unlinkSync(scriptPathPublic); console.log('✓ public/review-toolbar.js removido') }

  // Remove a tag script do HTML (CDN ou local)
  const htmlPaths = [
    path.join(cwd, 'index.html'),
    path.join(cwd, 'public', 'index.html'),
    path.join(cwd, 'src', 'index.html'),
  ]
  const htmlPath = htmlPaths.find(p => fs.existsSync(p))

  if (htmlPath) {
    let html = fs.readFileSync(htmlPath, 'utf-8')
    if (html.includes('review-toolbar.js') || html.includes('review-handoff-plugin')) {
      html = html.replace(/\s*<script[^>]*review-toolbar\.js[^>]*><\/script>\n?/g, '\n')
      html = html.replace(/\s*<script[^>]*review-handoff-plugin[^>]*><\/script>\n?/g, '\n')
      fs.writeFileSync(htmlPath, html, 'utf-8')
      console.log(`✓ Script removido de ${htmlPath.replace(cwd, '.')}`)
    } else {
      console.log('⚠️  Tag script não encontrada no HTML')
    }
  }

  printDone()
}

function printDone() {
  console.log('\n✅ Plugin removido com sucesso!\n')
}

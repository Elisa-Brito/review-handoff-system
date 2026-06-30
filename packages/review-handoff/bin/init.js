#!/usr/bin/env node

if (process.argv[2] === 'remove') {
  require('./remove.js')
  process.exit(0)
}

console.log(`
┌─────────────────────────────────────────────────────┐
│           Review Handoff Plugin — Setup             │
└─────────────────────────────────────────────────────┘

Para instalar o plugin, escolha uma das opções abaixo
e envie as informações para a Elisa:

──────────────────────────────────────────────────────
  Opção 1 — GitHub (recomendado)

  1. Acesse github.com/SEU-REPO/settings
  2. Altere o repositório para público
  3. Me mande o link do repo
     (ex: github.com/empresa/projeto)

──────────────────────────────────────────────────────
  Opção 2 — Pasta local

  1. Abra a pasta do projeto no seu computador
  2. Compartilhe o acesso via sessão remota

──────────────────────────────────────────────────────

A Elisa injeta o script e já fica funcionando
no próximo deploy. 🚀
`)

// Corrige NCMs que perderam o zero à esquerda em relatórios já importados antes do
// fix em lib/admin-engine.ts (normalizeNcm) — ex.: "2013000" devia ser "02013000".
// Roda uma vez sobre os dados já salvos em data/admin.db:
//   node scripts/fix-ncm-leading-zero.mjs
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const DB_PATH = path.join(process.cwd(), 'data', 'admin.db')
const db = new DatabaseSync(DB_PATH)

function normalizeNcm(v) {
  const s = String(v ?? '').trim()
  return /^\d{1,7}$/.test(s) ? s.padStart(8, '0') : s
}

function patchArray(arr, key) {
  if (!Array.isArray(arr)) return false
  let changed = false
  for (const item of arr) {
    if (item && typeof item[key] === 'string') {
      const fixed = normalizeNcm(item[key])
      if (fixed !== item[key]) { item[key] = fixed; changed = true }
    }
  }
  return changed
}

// --- 1. Relatórios salvos (report_json) ---
const reports = db.prepare('SELECT id, report_json FROM admin_reports').all()
let reportsFixed = 0
for (const row of reports) {
  const report = JSON.parse(row.report_json)
  let changed = false
  changed = patchArray(report.comprasNCM, 'ncm') || changed
  changed = patchArray(report.vendasNCM, 'codigo') || changed
  changed = patchArray(report.simulador, 'ncm') || changed
  changed = patchArray(report.dreProduto, 'ncm') || changed
  changed = patchArray(report.margemProdutos, 'ncm') || changed
  if (changed) {
    db.prepare('UPDATE admin_reports SET report_json = ? WHERE id = ?').run(JSON.stringify(report), row.id)
    reportsFixed++
  }
}
console.log(`Relatórios corrigidos: ${reportsFixed} de ${reports.length}`)

// --- 2. Overrides manuais de categoria (ncm_categoria_overrides) ---
const overrides = db.prepare('SELECT ncm, categoria_codigo, updated_at FROM ncm_categoria_overrides').all()
let overridesFixed = 0
for (const o of overrides) {
  const fixed = normalizeNcm(o.ncm)
  if (fixed === o.ncm) continue
  // Se já existir um override pro NCM corrigido, mantém o mais recente.
  const existing = db.prepare('SELECT updated_at FROM ncm_categoria_overrides WHERE ncm = ?').get(fixed)
  if (!existing || new Date(o.updated_at) > new Date(existing.updated_at)) {
    db.prepare(`
      INSERT INTO ncm_categoria_overrides (ncm, categoria_codigo, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(ncm) DO UPDATE SET categoria_codigo = excluded.categoria_codigo, updated_at = excluded.updated_at
    `).run(fixed, o.categoria_codigo, o.updated_at)
  }
  db.prepare('DELETE FROM ncm_categoria_overrides WHERE ncm = ?').run(o.ncm)
  overridesFixed++
}
console.log(`Overrides corrigidos: ${overridesFixed} de ${overrides.length}`)

db.close()

// Relatórios salvos antes da feature de margem bruta/contribuição no simulador não têm os
// campos novos (SimuladorRow.margemBrutaPct/margemContribuicaoPct, DreProdutoRow idem,
// AdminReportV2.simuladorMercadologica) — eles são computados a partir de comprasNCM/vendasNCM
// no momento do import, não relidos depois. Este script recomputa esses campos pros relatórios
// já salvos em data/admin.db, usando os mesmos comprasNCM/vendasNCM já armazenados.
//   npx tsx scripts/backfill-simulador-margens.ts
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import {
  computeSimulador, computeDreProduto, computeMargemProdutos, computeMargemContribuicaoPorCategoria,
  type AdminReportV2,
} from '../lib/admin-engine'

const DB_PATH = path.join(process.cwd(), 'data', 'admin.db')
const db = new DatabaseSync(DB_PATH)

const rows = db.prepare('SELECT id, report_json FROM admin_reports').all() as { id: number; report_json: string }[]
let fixed = 0
for (const row of rows) {
  const report = JSON.parse(row.report_json) as AdminReportV2
  if (!report.comprasNCM?.length || !report.vendasNCM?.length) continue

  const jaTemCampo = report.simulador?.[0] && 'margemBrutaDRPct' in report.simulador[0]
  if (jaTemCampo) continue

  report.simulador = computeSimulador(report.comprasNCM, report.vendasNCM)
  report.dreProduto = computeDreProduto(report.comprasNCM, report.vendasNCM)
  report.margemProdutos = computeMargemProdutos(report.comprasNCM, report.vendasNCM)
  report.simuladorMercadologica = computeMargemContribuicaoPorCategoria(report.margemProdutos)

  db.prepare('UPDATE admin_reports SET report_json = ? WHERE id = ?').run(JSON.stringify(report), row.id)
  fixed++
}
console.log(`Relatórios recomputados: ${fixed} de ${rows.length}`)
db.close()

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { getAdminReport, listVisibleAnalisesForEmpresa } from '@/lib/db-admin'
import { resumoPeriodo, type AdminReportV2 } from '@/lib/admin-engine'
import { getActiveEmpresaId } from '@/lib/active-company'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const empresaId = await getActiveEmpresaId(user.id)
  if (!empresaId) return NextResponse.json({ resumos: [] })

  // Comparativo é entre análises distintas (lotes importados em momentos diferentes), não entre
  // os 8 anos de transição de UMA análise — senão os anos 2026-2033 de um único import aparecem
  // como se fossem 8 períodos reais pra comparar. Uma análise = 1 ponto no gráfico, com o resumo
  // tirado do relatório do ano-base (2026), igual ao card do dashboard.
  const analises = listVisibleAnalisesForEmpresa(empresaId)
  const resumos = analises
    .map((a) => {
      const full = getAdminReport(a.id)
      if (!full) return null
      try {
        const report = JSON.parse(full.report_json) as AdminReportV2
        return { id: a.id, periodo: a.periodo, createdAt: a.created_at, resumo: resumoPeriodo(report) }
      } catch {
        return null
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({ resumos })
}

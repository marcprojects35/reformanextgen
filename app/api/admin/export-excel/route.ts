import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getAdminReport } from '@/lib/db-admin'
import * as XLSX from 'xlsx'
import type { AdminReportV2 } from '@/lib/admin-engine'

export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))
  if (!id || isNaN(id)) return NextResponse.json({ error: 'ID necessário.' }, { status: 400 })

  const row = getAdminReport(id)
  if (!row) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  const report = JSON.parse(row.report_json) as AdminReportV2
  const wb = XLSX.utils.book_new()

  if (report.compras.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.compras.map(c => ({
      Categoria: c.categoria,
      'Valor AR': c.valorAR, 'Impostos AR': c.impostosAR, 'Custo AR': c.custoAR,
      '% Custo AR': c.custoEfetivoARPct, 'Crédito AR': c.creditoAR, '% Carga AR': c.cargaTributariaARPct,
      'Valor DR': c.valorDR, 'Impostos DR': c.impostosDR, 'Custo DR': c.custoDR,
      '% Custo DR': c.custoEfetivoDRPct, 'Crédito DR': c.creditoDR,
    }))), 'Compras')
  }

  if (report.vendas.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.vendas.map(v => ({
      Categoria: v.categoria,
      'Valor AR': v.valorAR, 'Impostos AR': v.impostosAR, 'Débito AR': v.debitoAR,
      'Desonerado': v.valorDesonerado, '% Carga AR': v.cargaTributariaARPct,
      'Valor DR': v.valorDR, 'Impostos DR': v.impostosDR, 'Débito DR': v.debitoDR,
      '% Carga DR': v.cargaTributariaDRPct,
    }))), 'Vendas')
  }

  if (report.dre.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.dre.map(d => ({
      Categoria: d.categoria, AR: d.ar, 'Ano Base DR': d.anoBase,
      'Diff R$': d.diffRS, 'Diff %': d.diffPct,
      ...Object.fromEntries(Object.entries(d.anos).map(([a, v]) => [a, v])),
    }))), 'DRE')
  }

  if (report.fluxo.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.fluxo.map(f => ({
      Categoria: f.categoria, AR: f.ar, DR: f.dr, 'Diff R$': f.diffRS, 'Diff %': f.diffPct,
      ...Object.fromEntries(Object.entries(f.anos).map(([a, v]) => [a, v])),
    }))), 'Fluxo')
  }

  if (report.comprasNCM?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.comprasNCM.map(c => ({
      Produto: c.descricao ?? '', 'Código Produto': c.codigoProduto ?? '',
      NCM: c.ncm, 'Valor AR': c.valorAR, 'Valor DR': c.valorDR,
      '% Carga AR': c.cargaARPct, '% Carga DR': c.cargaDRPct,
      'Custo AR': c.custoAR, 'Custo DR': c.custoDR, Monofásico: c.isMonofasico ? 'Sim' : 'Não',
    }))), 'Compras_NCM')
  }

  if (report.vendasNCM?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.vendasNCM.map(v => ({
      Produto: v.descricao ?? '', 'Código Produto': v.codigoProduto ?? '',
      NCM: v.codigo, 'Valor AR': v.valorAR, 'Valor DR': v.valorDR,
      '% Carga AR': v.cargaARPct, '% Carga DR': v.cargaDRPct,
      'Tributos AR': v.tributosAR, 'Tributos DR': v.tributosDR, 'Diff Custo': v.diffCusto,
    }))), 'Vendas_NCM')
  }

  if (report.simulador?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.simulador.map(s => {
      const porAno = Object.fromEntries(
        s.projecao.flatMap(p => [[`${p.ano} Preço`, p.precoVenda], [`${p.ano} Resultado`, p.resultado]]),
      )
      return {
        Produto: s.descricao ?? '', 'Código Produto': s.codigoProduto ?? '',
        NCM: s.ncm, Categoria: s.categoriaMercadologica?.secao ?? '',
        'Custo AR': s.custoAR, 'Custo DR': s.custoDR,
        'Venda AR': s.valorVendaAR, 'Venda DR': s.valorVendaDR,
        'Markup Atual %': s.markupAtualPct,
        'Margem Bruta AR %': s.margemBrutaARPct, 'Margem Bruta DR %': s.margemBrutaDRPct,
        'Margem Contribuição AR %': s.margemContribuicaoARPct, 'Margem Contribuição DR %': s.margemContribuicaoDRPct,
        'Resultado AR': s.resultadoAtual, 'Resultado DR': s.resultadoDR,
        ...porAno,
      }
    })), 'Simulador')
  }

  if (report.simuladorMercadologica?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.simuladorMercadologica.map(m => ({
      Categoria: m.categoria, 'Receita AR': m.receitaAR, 'Receita DR': m.receitaDR,
      'Margem Contribuição AR %': m.margemContribuicaoARPct, 'Margem Contribuição DR %': m.margemContribuicaoDRPct,
      Produtos: m.count,
    }))), 'Margem_Contrib_Categoria')
  }

  if (report.comprasSimples?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.comprasSimples.map(s => ({
      Fornecedor: s.nome || s.cnpj, CNPJ: s.cnpj, 'Valor AR': s.valorAR, '% Compras': s.pctTotalCompras,
      NCMs: s.ncms.map(n => n.ncm).join(', '),
    }))), 'Fornec_Simples')
  }

  if (report.dreProduto?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.dreProduto.map(d => ({
      Produto: d.descricao ?? '', 'Código Produto': d.codigoProduto ?? '',
      NCM: d.ncm, Categoria: d.categoriaMercadologica?.secao ?? '',
      'Receita AR': d.receitaAR, 'Custo AR': d.custoAR,
      'Margem AR %': d.margemBrutaARPct, 'Resultado AR': d.resultadoAtual,
      'Resultado DR': d.resultadoDR, 'Margem DR %': d.margemBrutaDRPct,
      'Margem Contribuição AR %': d.margemContribuicaoARPct, 'Margem Contribuição DR %': d.margemContribuicaoDRPct,
      'Diff Resultado': d.diffResultado,
      ...Object.fromEntries(d.projecao.map(p => [`${p.ano} Resultado`, p.resultado])),
    }))), 'DRE_Produto')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `${row.empresa}-${row.periodo}-reforma-nextgen.xlsx`.replace(/[^a-zA-Z0-9._-]/g, '_')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

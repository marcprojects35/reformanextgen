import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { gerarRelatorioV2, mergeReports, getWorkbookDebugInfo, parseMercadologicaClassificacao } from '@/lib/admin-engine'
import {
  saveAdminReport, getEmpresa, getNcmCategoriaOverrides,
  getProdutoCategoriaCache, setProdutoCategoriaCache,
} from '@/lib/db-admin'
import { enrichReportComNomesDeCnpj } from '@/lib/cnpj-lookup'

const ALLOWED_EXTS = ['xlsx', 'xls', 'csv']

function validateFile(file: File | null, fieldName: string): string | null {
  if (!file) return `Arquivo "${fieldName}" não enviado.`
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTS.includes(ext)) {
    return `Formato inválido em "${fieldName}". Use .xlsx, .xls ou .csv.`
  }
  return null
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const fileProdutos  = formData.get('fileProdutos')  as File | null
  const fileServicos  = formData.get('fileServicos')  as File | null
  // Planilha mercadológica (opcional, ex.: "LJ 01") — traz a classificação real de produtos
  // por Seção/Grupo/Subgrupo/Família, usada em vez do palpite por similaridade de texto.
  const fileMercadologica = formData.get('fileMercadologica') as File | null
  // Legacy single-file support (backwards compat)
  const fileSingle    = formData.get('file')          as File | null

  const empresaIdRaw = formData.get('empresaId') as string | null
  const empresaId = empresaIdRaw ? Number(empresaIdRaw) : null
  const periodoForm = (formData.get('periodo') as string | null) ?? ''
  // Mês/ano real da análise (ex. "2026-07") — igual pros 8 blocos de uma mesma importação,
  // usado só pra agrupar/deduplicar (ver saveAdminReport, getEmpresaAnalises).
  const lote = (formData.get('lote') as string | null) || null
  const empresaCadastrada = empresaId ? getEmpresa(empresaId) : null

  // Nome/CNPJ/período informados na tela de importar têm prioridade sobre o que
  // vier (ou não vier) na planilha — planilhas reais quase nunca trazem isso.
  const defaultEmpresa = empresaCadastrada || periodoForm
    ? {
        empresa: empresaCadastrada?.nome,
        cnpj: empresaCadastrada?.cnpj,
        regime: empresaCadastrada?.regime,
        periodo: periodoForm || undefined,
      }
    : undefined

  // Determine mode: dual-file or single-file
  const isDual = !!(fileProdutos || fileServicos)

  if (isDual) {
    // Cada planilha é opcional individualmente — basta uma das duas para gerar
    // uma análise (parcial, cobrindo só o domínio enviado). Só valida o que veio.
    if (fileProdutos) {
      const errP = validateFile(fileProdutos, 'Produtos')
      if (errP) return NextResponse.json({ error: errP }, { status: 400 })
    }
    if (fileServicos) {
      const errS = validateFile(fileServicos, 'Serviços')
      if (errS) return NextResponse.json({ error: errS }, { status: 400 })
    }
    if (fileMercadologica) {
      const errM = validateFile(fileMercadologica, 'Estrutura Mercadológica')
      if (errM) return NextResponse.json({ error: errM }, { status: 400 })
    }

    try {
      const bufP = fileProdutos ? Buffer.from(await fileProdutos.arrayBuffer()) : null
      const bufS = fileServicos ? Buffer.from(await fileServicos.arrayBuffer()) : null
      const overridesNCM = getNcmCategoriaOverrides()

      // codigo_produto → Cod Familia já conhecidos de anos anteriores desta mesma empresa
      // (salvo da última vez que uma planilha mercadológica real foi enviada). Reaproveitado
      // como base — se o usuário enviar uma planilha nova neste import, ela tem prioridade
      // (permite corrigir/atualizar), mas produtos que só existem no cache continuam cobertos.
      const cacheEmpresa = empresaId ? getProdutoCategoriaCache(empresaId) : {}

      // Opcional — se não vier, cai no cache da empresa; sem cache nem arquivo, gerarRelatorioV2
      // recebe `undefined` e cai no palpite por texto de sempre (lib/merc-classifier.ts).
      const mapaMercadologicaArquivo = fileMercadologica
        ? parseMercadologicaClassificacao(Buffer.from(await fileMercadologica.arrayBuffer()), fileMercadologica.name)
        : undefined
      const mapaMercadologicaMerged = { ...cacheEmpresa, ...mapaMercadologicaArquivo }
      const mapaMercadologica = Object.keys(mapaMercadologicaMerged).length ? mapaMercadologicaMerged : undefined

      // Persiste só o que veio de uma planilha real enviada agora — é dado confiável, vale a
      // pena guardar pros próximos anos. Não persiste o merge todo (evitaria "esquecer" um
      // produto que estava no cache mas não existe mais na planilha atual).
      if (empresaId && mapaMercadologicaArquivo && Object.keys(mapaMercadologicaArquivo).length) {
        setProdutoCategoriaCache(empresaId, mapaMercadologicaArquivo)
      }

      const reportP = bufP ? gerarRelatorioV2(bufP, defaultEmpresa, fileProdutos!.name, overridesNCM, mapaMercadologica) : null
      const reportS = bufS ? gerarRelatorioV2(bufS, defaultEmpresa, fileServicos!.name, overridesNCM, mapaMercadologica) : null
      const report  = reportP && reportS ? mergeReports(reportP, reportS) : (reportP ?? reportS)!

      const hasData =
        report.compras.length || report.vendas.length ||
        report.dre.length || report.fluxo.length ||
        report.comprasNCM.length || report.vendasNCM.length

      if (!hasData) {
        const debugP = bufP ? getWorkbookDebugInfo(bufP, fileProdutos!.name) : undefined
        const debugS = bufS ? getWorkbookDebugInfo(bufS, fileServicos!.name) : undefined
        console.error('[admin-import] Colunas detectadas:\nProdutos:\n' + (debugP ?? '(não enviado)') + '\nServiços:\n' + (debugS ?? '(não enviado)'))
        return NextResponse.json(
          {
            error: 'Nenhuma coluna reconhecida na planilha.',
            debug: { produtos: debugP, servicos: debugS },
          },
          { status: 422 },
        )
      }

      try {
        await enrichReportComNomesDeCnpj(report)
      } catch (err) {
        console.error('[admin-import] falha ao resolver nomes de CNPJ (seguindo sem nome)', err)
      }

      // Carimba origem — empresaId pra achar os relatórios irmãos (outros anos) da mesma
      // empresa direto no client, nomes de arquivo só pra exibir de onde veio o dado.
      report.empresa.empresaId = empresaId ?? undefined
      if (fileProdutos) report.empresa.arquivoProdutos = fileProdutos.name
      if (fileServicos) report.empresa.arquivoServicos = fileServicos.name
      if (fileMercadologica) report.empresa.arquivoMercadologica = fileMercadologica.name

      const salvar = formData.get('salvar') !== 'false'
      let savedId: number | null = null
      if (salvar) {
        savedId = saveAdminReport({
          empresa:    report.empresa.empresa || 'Sem nome',
          cnpj:       report.empresa.cnpj,
          regime:     report.empresa.regime,
          periodo:    report.empresa.periodo,
          reportJson: JSON.stringify(report),
          empresaId,
          lote,
        })
      }

      return NextResponse.json({ report, savedId })
    } catch (err) {
      console.error('[admin-import dual]', err)
      return NextResponse.json({ error: 'Erro ao processar as planilhas.' }, { status: 400 })
    }
  }

  // ── Single-file (legacy / single XLSX/CSV) ──
  const errSingle = validateFile(fileSingle, 'Planilha')
  if (errSingle) return NextResponse.json({ error: errSingle }, { status: 400 })

  try {
    const buffer = Buffer.from(await fileSingle!.arrayBuffer())
    const report = gerarRelatorioV2(buffer, undefined, undefined, getNcmCategoriaOverrides())

    const hasData =
      report.compras.length || report.vendas.length ||
      report.dre.length || report.fluxo.length

    if (!hasData) {
      return NextResponse.json(
        { error: 'Nenhuma aba reconhecida. Use: "Empresa", "Compras", "Vendas", "DRE", "Fluxo", "Regime".' },
        { status: 422 },
      )
    }

    try {
      await enrichReportComNomesDeCnpj(report)
    } catch (err) {
      console.error('[admin-import] falha ao resolver nomes de CNPJ (seguindo sem nome)', err)
    }

    const salvar = formData.get('salvar') !== 'false'
    let savedId: number | null = null
    if (salvar) {
      savedId = saveAdminReport({
        empresa:    report.empresa.empresa || 'Sem nome',
        cnpj:       report.empresa.cnpj,
        regime:     report.empresa.regime,
        periodo:    report.empresa.periodo,
        reportJson: JSON.stringify(report),
      })
    }

    return NextResponse.json({ report, savedId })
  } catch (err) {
    console.error('[admin-import single]', err)
    return NextResponse.json({ error: 'Erro ao processar planilha.' }, { status: 400 })
  }
}

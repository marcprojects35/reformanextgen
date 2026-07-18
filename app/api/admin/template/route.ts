import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const wb = XLSX.utils.book_new()

  // Sheet Empresa
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Campo', 'Valor'],
    ['Nome_Empresa', 'Empresa XYZ Ltda'],
    ['CNPJ', '12.345.678/0001-90'],
    ['Regime', 'Lucro Real'],
    ['Periodo', new Date().toISOString().slice(0, 7)],
  ]), 'Empresa')

  // Sheet Compras
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Categoria', 'Valor_AR', 'Impostos_AR', 'Valor_Desonerado', 'Custo_AR', 'Custo_Efetivo_AR', 'Credito_AR', 'Carga_Tributaria_AR', 'Valor_DR', 'Impostos_DR', 'Custo_DR', 'Custo_Efetivo_DR', 'Credito_DR'],
    ['Compras Produtos', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Serviços Tomados', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Locação Móveis', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Locação Imóveis', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Compras Imóveis', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'Compras')

  // Sheet Vendas
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Categoria', 'Valor_AR', 'Impostos_AR', 'Debito_AR', 'Valor_Desonerado', 'Carga_AR', 'Valor_DR', 'Impostos_DR', 'Debito_DR', 'Carga_DR'],
    ['Vendas Produtos', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Serviços Prestados', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Locação Móveis', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Locação Imóveis', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Vendas Imóveis', 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'Vendas')

  // Sheet DRE
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Categoria', 'AR', 'Ano_Base', 'Diff_RS', 'Diff_Pct', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
    ['Receita Bruta', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Deduções Tributos', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Custo', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Lucro Bruto', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Despesas', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Lucro Antes IR/CS', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['IR/CS', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Lucro Líquido', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'DRE')

  // Sheet Fluxo
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Categoria', 'AR', 'DR', 'Diff_RS', 'Diff_Pct', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
    ['Fornecedores', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Despesas', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Tributos Crédito', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Clientes', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Tributos Débito', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Tributos Recolhidos', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Saldo Credor', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Resultado', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'Fluxo')

  // Sheet Regime
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Regime', 'Resultado_Pos_IRCS', 'Tributos_Credito', 'Tributos_Debito', 'Tributos_Recolhidos'],
    ['Lucro Real', 0, 0, 0, 0],
    ['Lucro Presumido', 0, 0, 0, 0],
  ]), 'Regime')

  // Sheet Compras_NCM (gráficos de pizza e treemap por NCM)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['NCM', 'Valor_AR', 'Valor_DR', 'Carga_AR', 'Carga_DR'],
    ['02013000', 0, 0, 0, 0],
    ['22030000', 0, 0, 0, 0],
    ['09012100', 0, 0, 0, 0],
  ]), 'Compras_NCM')

  // Sheet Compras_Regime (pizza regime fornecedor)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Regime', 'Valor_AR'],
    ['Lucro Real', 0],
    ['Lucro Presumido', 0],
    ['Simples Nacional', 0],
  ]), 'Compras_Regime')

  // Sheet Compras_Fornecedor (tabelas maior aumento / maior redução)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['CNPJ', 'Media_Carga_AR', 'Media_Carga_DR', 'Soma_Valor_AR', 'Soma_Valor_Desonerado', 'Tributos_AR', 'Soma_Valor_DR', 'Tributos_DR', 'Soma_Custo_AR'],
    ['00.000.000/0001-00', 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'Compras_Fornecedor')

  // Sheet Compras_CFOP (tabela por CFOP)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['CFOP', 'Media_Carga_AR', 'Media_Carga_DR', 'Soma_Valor_AR', 'Soma_Valor_Desonerado', 'Tributos_AR', 'Soma_Valor_DR', 'Tributos_DR', 'Soma_Diff_Custo'],
    ['1403', 0, 0, 0, 0, 0, 0, 0, 0],
    ['2102', 0, 0, 0, 0, 0, 0, 0, 0],
  ]), 'Compras_CFOP')

  // Shared header for Vendas detail sheets
  const VD_HDR = ['Codigo', 'Media_Carga_AR', 'Media_Carga_DR', 'Soma_Valor_AR', 'Soma_Valor_Desonerado', 'Tributos_AR', 'Soma_Valor_DR', 'Tributos_DR', 'Soma_Diff_Custo']
  const VD_ROW = (codigo: string) => [codigo, 0, 0, 0, 0, 0, 0, 0, 0]

  // Sheet Vendas_NCM (donut + treemap + tabela NCM de vendas)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['NCM', ...VD_HDR.slice(1)],
    VD_ROW('02013000'),
    VD_ROW('22030000'),
  ]), 'Vendas_NCM')

  // Sheet Vendas_Cliente (tabelas maior aumento / maior redução clientes)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['CNPJ', ...VD_HDR.slice(1)],
    VD_ROW('00.000.000/0001-00'),
  ]), 'Vendas_Cliente')

  // Sheet Vendas_CFOP (tabela por CFOP de vendas)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['CFOP', ...VD_HDR.slice(1)],
    VD_ROW('5102'),
    VD_ROW('5405'),
  ]), 'Vendas_CFOP')

  // ── Sheet: Formato CSV Transações (formato alternativo de importação) ──────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['FORMATO ALTERNATIVO: CSV de Transações Brutas', '', '', '', '', '', '', ''],
    ['Use este formato quando quiser importar dados transacionais (linha a linha).', '', '', '', '', '', '', ''],
    ['Salve como .csv com separador ponto-e-vírgula (;)', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    [
      'tipo_movimentacao',
      'valor_ar',
      'valor_dr',
      'porcentagem_carga_tributaria_ar',
      'porcentagem_carga_tributaria_dr',
      'ncm',
      'cfop',
      'cnpj_outra_parte',
      'regime_tributario_outra_parte',
    ],
    ['Compra', '1000.00', '950.00', '12.50', '8.80', '02013000', '1102', '12345678000190', 'Lucro Real'],
    ['Compra', '500.00', '480.00', '9.00', '7.50', '22030000', '1102', '98765432000155', 'Simples Nacional'],
    ['Venda', '2000.00', '1900.00', '15.00', '10.20', '02013000', '5102', '11122233344', ''],
    ['Venda', '800.00', '780.00', '12.00', '9.00', '22030000', '5405', '44455566677', ''],
    ['', '', '', '', '', '', '', ''],
    ['CAMPOS OBRIGATÓRIOS:', '', '', '', '', '', '', ''],
    ['tipo_movimentacao', 'Compra ou Venda (texto livre, case-insensitive)', '', '', '', '', '', ''],
    ['valor_ar', 'Valor antes da reforma (número decimal, ponto ou vírgula)', '', '', '', '', '', ''],
    ['valor_dr', 'Valor depois da reforma (número decimal)', '', '', '', '', '', ''],
    ['porcentagem_carga_tributaria_ar', 'Carga tributária AR em % (ex: 12.5)', '', '', '', '', '', ''],
    ['porcentagem_carga_tributaria_dr', 'Carga tributária DR em % (ex: 8.8)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['CAMPOS OPCIONAIS (enriquecem a análise):', '', '', '', '', '', '', ''],
    ['ncm', 'Código NCM (8 dígitos) — habilita análise por produto e simulador', '', '', '', '', '', ''],
    ['cfop', 'Código CFOP (4 dígitos) — habilita categorização por tipo de operação', '', '', '', '', '', ''],
    ['cnpj_outra_parte', 'CNPJ do fornecedor/cliente (14 dígitos, sem pontuação) ou CPF (11 dígitos)', '', '', '', '', '', ''],
    ['regime_tributario_outra_parte', 'Regime do fornecedor/cliente: Lucro Real, Lucro Presumido, Simples Nacional', '', '', '', '', '', ''],
  ]), 'CSV_Instrucoes')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-reforma-nextgen.xlsx"',
    },
  })
}

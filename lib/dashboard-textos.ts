/** Registro fixo das chaves de texto editáveis por empresa no dashboard de relatório.
 *  Cada chave tem um valor padrão (o texto hardcoded original) — a empresa só precisa de
 *  uma linha em `dashboard_textos` (lib/db-admin.ts) quando quiser sobrescrever. */
export interface DashboardTextoField {
  chave: string
  label: string
  padrao: string
  multiline?: boolean
}

export const DASHBOARD_TEXTO_FIELDS: DashboardTextoField[] = [
  { chave: 'hero.titulo', label: 'Título principal (Visão Geral)', padrao: 'Impacto da Reforma' },
  { chave: 'hero.subtitulo', label: 'Subtítulo (Visão Geral)', padrao: 'Análise comparativa antes/depois da Reforma Tributária', multiline: true },
  { chave: 'anoCard.titulo', label: 'Rótulo do seletor de ano', padrao: 'Depois da Reforma' },
  {
    chave: 'anoCard.descricao',
    label: 'Descrição do card de ano',
    padrao: 'O sistema sempre usa o ano atual (2026) como base "antes da reforma". Escolha em qual ano da transição (2026 a 2033) você quer ver o "depois" — todo o dashboard passa a refletir os dados reais importados daquele ano.',
    multiline: true,
  },
  { chave: 'kpi.compras.bom', label: 'KPI Compras — título quando custo cai', padrao: 'Economia Real' },
  { chave: 'kpi.compras.ruim', label: 'KPI Compras — título quando custo sobe', padrao: 'Mais Imposto' },
  { chave: 'kpi.vendas.bom', label: 'KPI Vendas — título quando vendas sobem', padrao: 'Vendas em Alta' },
  { chave: 'kpi.vendas.ruim', label: 'KPI Vendas — título quando vendas caem', padrao: 'Vendas em Queda' },
]

import type { RegimeAtual, SimulationStatus, Setor } from '@/lib/db'

export const setorLabels: Record<Setor, string> = {
  comercio: 'Comércio',
  industria: 'Indústria',
  servicos: 'Serviços',
  servicos_fator_r: 'Serviços (Fator R)',
  agropecuaria: 'Agropecuária',
}

export const regimeAtualLabels: Record<RegimeAtual, string> = {
  simples: 'Simples Nacional',
  presumido: 'Lucro Presumido',
  real: 'Lucro Real',
}

export const statusLabels: Record<SimulationStatus, string> = {
  rascunho: 'Rascunho',
  processando: 'Processando',
  concluida: 'Concluída',
  erro: 'Erro',
}

export const ufOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function formatSqliteDate(value: string): string {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}

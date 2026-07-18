// Formatters compartilhados por todo o admin (terminal financeiro).
// Antes duplicados com pequenas variações em ~8 componentes — fonte única aqui.

export const R$ = (n: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)

export const pct = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

export const sign = (n: number) => (n > 0 ? '+' : '')

/** R$ compacto (K/M/B) para eixos de gráfico, tooltips e hero numbers. */
export function fmtShort(v: number): string {
  const abs = Math.abs(v)
  const prefix = v < 0 ? '-' : ''
  if (abs >= 1e9) return `${prefix}R$ ${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${prefix}R$ ${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${prefix}R$ ${(abs / 1e3).toFixed(1)}K`
  return `${prefix}R$ ${abs.toFixed(0)}`
}

/** Escolhe a escala (K/M/B) a partir do valor final, para animação de contador. */
export function makeFmt(finalValue: number) {
  const abs = Math.abs(finalValue)
  if (abs >= 1e9) return (v: number) => `R$ ${(Math.abs(v) / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return (v: number) => `R$ ${(Math.abs(v) / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return (v: number) => `R$ ${(Math.abs(v) / 1e3).toFixed(1)}K`
  return (v: number) => `R$ ${Math.abs(v).toFixed(0)}`
}

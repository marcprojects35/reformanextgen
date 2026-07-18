'use client'

/**
 * Rótulo clicável para o eixo Y (categoria) dos gráficos de barra horizontal.
 * Recharts injeta x/y/payload/index ao clonar este elemento via prop `tick`.
 * Usa `index` (não `payload.value`) pra identificar a linha, já que o valor
 * pode já vir truncado pelo `formatter` — index sempre bate 1:1 com a ordem
 * do array de dados que alimentou o gráfico.
 */
export function ClickableTick({
  x = 0,
  y = 0,
  payload,
  index = 0,
  onSelect,
  formatter,
  fontSize = 10,
  dotColor,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  index?: number
  onSelect: (index: number) => void
  formatter?: (value: string) => string
  fontSize?: number
  /** Cor de uma bolinha extra à esquerda do eixo (ex.: categoria de operação do
   *  item) — `undefined`/vazio pra uma linha específica não desenha nada. */
  dotColor?: (index: number) => string | undefined
}) {
  const raw = payload?.value ?? ''
  const label = formatter ? formatter(raw) : raw
  const dot = dotColor?.(index)
  return (
    <g onClick={() => onSelect(index)} cursor="pointer">
      {dot && <circle cx={4} cy={y} r={3} fill={dot} />}
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fontSize={fontSize}
        className="transition-opacity hover:opacity-70"
        fill="color-mix(in srgb, var(--foreground) 50%, transparent)"
      >
        {label}
      </text>
    </g>
  )
}

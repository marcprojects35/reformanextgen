'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

const HOVER_DELAY_MS = 3000
const MARGIN = 12
const MAX_WIDTH = 280

interface Coords {
  top: number
  left: number
  placement: 'top' | 'bottom'
}

/**
 * Lógica compartilhada de "passar o mouse e segurar 3s mostra uma explicação" —
 * usada tanto pelo wrapper <Explain> (cards/títulos, qualquer elemento genérico)
 * quanto direto em elementos que não podem ser envolvidos por um wrapper (linha
 * de tabela `<tr>`, célula de gráfico SVG `<Cell>`) via os handlers retornados.
 * `hovering` fica true assim que o mouse entra (sem esperar os 3s) — é o sinal
 * usado pro destaque imediato (subir/dourar); o tooltip em si só aparece depois
 * do delay. Diferente do drill-down (useDrillDown), que abre no clique e mostra
 * DE ONDE veio o número na planilha; este é conceitual ("o que é isso"), aparece
 * sozinho sem precisar clicar.
 */
export function useExplainHover<T extends Element = HTMLElement>(text: string) {
  const elRef = useRef<T | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovering, setHovering] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    setCoords(null)
    setHovering(false)
  }, [clearTimer])

  const onMouseEnter = useCallback(() => {
    setHovering(true)
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      const rect = elRef.current?.getBoundingClientRect()
      if (!rect) return
      const fitsBelow = rect.bottom + 120 < window.innerHeight
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, MAX_WIDTH / 2 + MARGIN),
        window.innerWidth - MAX_WIDTH / 2 - MARGIN,
      )
      setCoords({
        top: fitsBelow ? rect.bottom + 8 : rect.top - 8,
        left,
        placement: fitsBelow ? 'bottom' : 'top',
      })
    }, HOVER_DELAY_MS)
  }, [clearTimer])

  // Reposicionar em scroll deixaria a caixa "grudada" enquanto o usuário rola — mais
  // simples e previsível é só esconder, igual a maioria dos tooltips do sistema operacional.
  useEffect(() => {
    if (!coords) return
    const onScroll = () => hide()
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
    }
  }, [coords, hide])

  useEffect(() => () => clearTimer(), [clearTimer])

  const tooltip = mounted && createPortal(
    <AnimatePresence>
      {coords && (
        <motion.div
          initial={{ opacity: 0, y: coords.placement === 'bottom' ? -4 : 4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed z-[70] rounded-xl border border-border bg-popover/95 px-3.5 py-2.5 text-xs leading-relaxed text-foreground/80 shadow-2xl backdrop-blur-xl"
          style={{
            top: coords.top,
            left: coords.left,
            transform: `translate(-50%, ${coords.placement === 'bottom' ? '0' : '-100%'})`,
            maxWidth: MAX_WIDTH,
          }}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )

  return { ref: elRef, hovering, onMouseEnter, onMouseLeave: hide, tooltip }
}

/** Classes compartilhadas do "levantar/crescer" sutil no hover — mesmo efeito em
 *  todo canto que usa <Explain> (cards, títulos de gráfico/tabela). */
export const EXPLAIN_LIFT_CLASS = 'transition-transform duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:scale-[1.015]'

/**
 * Envolve qualquer card/caixa/texto — passar o mouse já dá um leve "subir/crescer"
 * (feedback imediato de que aquilo é interativo/explicável); segurar por 3s mostra
 * a explicação do que aquele campo significa. Reaproveitado em admin, cliente
 * logado e link público — os três renderizam a mesma árvore de componentes
 * (ver report-dashboard.tsx).
 */
export function Explain({ text, children, className = '' }: { text: string; children: React.ReactNode; className?: string }) {
  const { ref, onMouseEnter, onMouseLeave, tooltip } = useExplainHover<HTMLSpanElement>(text)
  return (
    <span
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`cursor-help ${EXPLAIN_LIFT_CLASS} ${className}`}
    >
      {children}
      {tooltip}
    </span>
  )
}

/**
 * Mesma explicação por hover de 3s do <Explain>, mas pra uma linha de tabela
 * (`<tr>` não pode ser envolvido por um `<span>` — quebraria a semântica/render
 * da tabela). Além da explicação, destaca a linha inteira em dourado (cor da
 * marca) assim que o mouse entra, sem esperar os 3s — mesmo padrão visual dos
 * gráficos (ver `chartHoverFill`/`chartHoverProps` em lib/admin-colors.tsx).
 */
export function ExplainRow({
  text, className = '', children, onClick,
}: {
  text: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const { ref, hovering, onMouseEnter, onMouseLeave, tooltip } = useExplainHover<HTMLTableRowElement>(text)
  return (
    <tr
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`transition-all duration-150 ${hovering ? '-translate-y-px bg-primary/10' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
      {tooltip}
    </tr>
  )
}

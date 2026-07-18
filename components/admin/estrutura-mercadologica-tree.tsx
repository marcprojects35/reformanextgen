'use client'

import { useMemo } from 'react'

import type { CategoriaNode } from '@/lib/merc-categorias'

export const SECAO_ICONS: Record<string, string> = {
  'Alimentos':                  '🍽️',
  'Não Alimentos':               '🧴',
  'Apropriações':                '🧾',
  'Animais Vivos':               '🐾',
  'Material de Construção':      '🧱',
  'Automotivo':                  '🚗',
  'Hospitalar e Médico':         '🏥',
  'Veículos':                    '🚙',
  'Industrial e Equipamentos':   '⚙️',
  'Não Classificado':            '❔',
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function FilterPopover({
  tree, selectedGrupos, setSelectedGrupos, onClose,
}: {
  tree: CategoriaNode[]
  selectedGrupos: Set<string>
  setSelectedGrupos: React.Dispatch<React.SetStateAction<Set<string>>>
  onClose: () => void
}) {
  const todosGrupos = useMemo(() => tree.flatMap(s => s.filhos.map(g => g.codigo)), [tree])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Filtrar por grupo</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:underline"
              onClick={() => setSelectedGrupos(new Set(todosGrupos))}
            >
              Todos
            </button>
            <button
              type="button"
              className="text-[10px] font-medium text-foreground/40 hover:underline"
              onClick={() => setSelectedGrupos(new Set())}
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {tree.map(secao => {
            const grupoCodigos = secao.filhos.map(g => g.codigo)
            const selectedCount = grupoCodigos.filter(c => selectedGrupos.has(c)).length
            const allSelected = selectedCount === grupoCodigos.length && grupoCodigos.length > 0

            return (
              <div key={secao.codigo}>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground/80">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allSelected }}
                    onChange={() => setSelectedGrupos(prev => {
                      const next = new Set(prev)
                      if (allSelected) grupoCodigos.forEach(c => next.delete(c))
                      else grupoCodigos.forEach(c => next.add(c))
                      return next
                    })}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span>{SECAO_ICONS[secao.descricao] ?? '📦'} {secao.descricao}</span>
                </label>
                <div className="mt-1 ml-5 space-y-1 border-l border-border/60 pl-3">
                  {secao.filhos.map(grupo => (
                    <label key={grupo.codigo} className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground/60">
                      <input
                        type="checkbox"
                        checked={selectedGrupos.has(grupo.codigo)}
                        onChange={() => setSelectedGrupos(prev => {
                          const next = new Set(prev)
                          if (next.has(grupo.codigo)) next.delete(grupo.codigo)
                          else next.add(grupo.codigo)
                          return next
                        })}
                        className="h-3 w-3 rounded border-border accent-primary"
                      />
                      {grupo.descricao}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

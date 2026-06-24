'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RecalculateButton({ simulationId }: { simulationId: number }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleRecalculate() {
    if (!confirm('Isso vai recalcular a simulação com os arquivos já enviados. Continuar?')) return
    setPending(true)
    try {
      await fetch(`/api/simulations/${simulationId}/upload`, {
        method: 'POST',
        body: new FormData(), // recalcular sem novos arquivos usa os line_items existentes
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRecalculate}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Recalculando…' : 'Recalcular'}
    </button>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteSimulationButton({ simulationId }: { simulationId: number }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta simulação? A ação não pode ser desfeita.')) return
    setPending(true)
    try {
      await fetch(`/api/simulations/${simulationId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      aria-label="Excluir simulação"
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Excluir
    </button>
  )
}

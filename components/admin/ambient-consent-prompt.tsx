'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { AmbientBackground } from '@/components/admin/ambient-background'

type Consent = 'accepted' | 'declined'

/** Hash curto e estável a partir do início do data URL do logo — chave por empresa sem precisar de backend. */
function hashKey(s: string): string {
  const sample = s.slice(0, 400)
  let hash = 0
  for (let i = 0; i < sample.length; i++) hash = (hash * 31 + sample.charCodeAt(i)) | 0
  return Math.abs(hash).toString(36)
}

/**
 * Pergunta ao cliente, na primeira vez, se ele quer o fundo ambiente com as cores
 * da própria marca (extraídas do logo). A escolha fica salva no navegador — só
 * pergunta de novo se ele limpar os dados do site ou acessar de outro navegador.
 */
export function AmbientConsentPrompt({ logoUrl }: { logoUrl?: string | null }) {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [storageKey, setStorageKey] = useState<string | null>(null)

  useEffect(() => {
    if (!logoUrl) { setConsent(null); setShowPrompt(false); return }
    const key = `ambient-bg-consent-${hashKey(logoUrl)}`
    setStorageKey(key)
    const stored = localStorage.getItem(key)
    if (stored === 'accepted' || stored === 'declined') {
      setConsent(stored)
      setShowPrompt(false)
    } else {
      setConsent(null)
      setShowPrompt(true)
    }
  }, [logoUrl])

  function decide(value: Consent) {
    if (storageKey) localStorage.setItem(storageKey, value)
    setConsent(value)
    setShowPrompt(false)
  }

  return (
    <>
      {consent === 'accepted' && <AmbientBackground logoUrl={logoUrl} />}

      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-50 flex w-[calc(100%-3rem)] max-w-xs items-start gap-3 rounded-xl border border-border bg-popover px-4 py-3.5 shadow-2xl"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-popover-foreground">Personalizar com sua marca?</p>
              <p className="mt-1 text-xs text-popover-foreground/45">
                Podemos deixar o fundo do relatório com um toque sutil das cores do seu logo.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => decide('accepted')}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  Ativar
                </button>
                <button
                  onClick={() => decide('declined')}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-popover-foreground/45 transition hover:text-popover-foreground"
                >
                  Não, obrigado
                </button>
              </div>
            </div>
            <button
              onClick={() => decide('declined')}
              aria-label="Fechar"
              className="text-popover-foreground/25 transition hover:text-popover-foreground/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

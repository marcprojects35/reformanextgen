'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MessageSquareText, Send, Loader2, LayoutGrid, X } from 'lucide-react'

export interface CommentSection {
  id: string
  label: string
}

export interface FocusSectionRequest {
  id: string
  nonce: number
}

interface CommentRow {
  id: number
  author_type: 'admin' | 'cliente'
  author_label: string | null
  section: string | null
  body: string
  created_at: string
}

export function ReportCommentsPanel({
  reportId,
  viewerRole,
  sections = [],
  focusSection = null,
  onCountsChange,
}: {
  reportId: number
  viewerRole: 'admin' | 'cliente'
  sections?: CommentSection[]
  focusSection?: FocusSectionRequest | null
  onCountsChange?: (counts: Record<string, number>) => void
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [loadError, setLoadError] = useState(false)
  const [sendError, setSendError] = useState('')

  const sectionLabel = useCallback(
    (id: string | null) => (id ? sections.find((s) => s.id === id)?.label ?? id : 'Geral'),
    [sections],
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${reportId}/comments`)
      if (!res.ok) { setLoadError(true); return }
      const data = await res.json()
      const rows = (data.comments ?? []) as CommentRow[]
      setComments(rows)
      setLoadError(false)
      if (onCountsChange) {
        const counts: Record<string, number> = {}
        for (const c of rows) {
          const key = c.section ?? 'geral'
          counts[key] = (counts[key] ?? 0) + 1
        }
        onCountsChange(counts)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [reportId, onCountsChange])

  // Sem isso, um comentário novo só aparecia pro outro lado (admin/cliente) depois de
  // recarregar a página inteira — a comunicação parecia "não funcionar".
  useEffect(() => {
    load()
    const interval = setInterval(load, 15_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!focusSection) return
    setFilter(focusSection.id)
    setOpen(true)
  }, [focusSection])

  // A aba de seção selecionada em cima é a mesma usada pra marcar onde o comentário novo
  // entra — evita ter dois seletores de "onde comentar" (um pra filtrar, outro pra postar).
  const activeSection = filter === 'all' ? 'geral' : filter

  async function handleSend() {
    const body = text.trim()
    if (!body) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/reports/${reportId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, section: activeSection === 'geral' ? null : activeSection }),
      })
      if (res.ok) {
        setText('')
        load()
      } else {
        const data = await res.json().catch(() => null)
        setSendError(data?.error ?? 'Não foi possível enviar o comentário.')
      }
    } catch {
      setSendError('Erro de conexão. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const visibleComments = comments.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'geral') return !c.section
    return c.section === filter
  })

  const filterOptions = [{ id: 'all', label: 'Todos' }, { id: 'geral', label: 'Geral' }, ...sections]
  const hoverLabel = viewerRole === 'admin' ? 'Comentários para o cliente' : 'Comentários'

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3 flex max-h-[75vh] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Comentários {viewerRole === 'admin' ? '(visíveis para o cliente)' : ''}
              </p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar comentários"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {sections.length > 0 && (
              <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5">
                <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-foreground/25" />
                {filterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFilter(opt.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      filter === opt.id
                        ? 'bg-primary/15 text-primary'
                        : 'text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex h-16 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {loadError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Não foi possível carregar os comentários. Tentando de novo automaticamente…
                  </p>
                )}
                {visibleComments.length === 0 ? (
                  <p className="text-xs text-foreground/30">Nenhum comentário ainda.</p>
                ) : (
                  visibleComments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-xl border px-3.5 py-2.5 text-sm ${
                        c.author_type === 'admin' ? 'border-primary/20 bg-primary/5' : 'border-border bg-foreground/[0.03]'
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-foreground/70">{c.author_label || (c.author_type === 'admin' ? 'Consultoria' : 'Cliente')}</span>
                        <span className="text-foreground/25">{new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}</span>
                        {c.section && (
                          <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground/45">
                            {sectionLabel(c.section)}
                          </span>
                        )}
                      </div>
                      <p className="text-foreground/80">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
              {sendError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  {sendError}
                </p>
              )}
              {sections.length > 0 && (
                <p className="text-[11px] text-foreground/35">
                  Comentando em <span className="font-semibold text-foreground/60">{sectionLabel(activeSection === 'geral' ? null : activeSection)}</span>
                  {' — '}selecione outra aba acima pra mudar
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Escreva um comentário..."
                  className="h-10 flex-1 min-w-0 rounded-xl border border-border bg-foreground/5 px-3.5 text-sm text-foreground placeholder-foreground/30 outline-none focus:border-primary/50"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed launcher — hover reveals the label, click opens the panel. Some quando o
          painel já está aberto, já que o header dele tem seu próprio botão de fechar — dois
          botões "X" empilhados era confuso. */}
      {!open && (
        <div className="group relative">
          <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-1.5 text-xs font-medium text-foreground/80 opacity-0 shadow-lg transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
            {hoverLabel}
          </span>
          <button
            onClick={() => setOpen(true)}
            aria-label={hoverLabel}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
          >
            <MessageSquareText className="h-5 w-5" />
            {comments.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold text-white">
                {comments.length}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

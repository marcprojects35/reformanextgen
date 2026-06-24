'use client'

import { WordReveal } from './word-reveal'
import { Parallax } from './parallax'

export function ManifestoSection() {
  return (
    <section className="relative overflow-hidden px-4 py-32 md:py-48">
      <Parallax
        speed={70}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: 'rgba(255,180,0,0.14)' }}
        />
      </Parallax>

      <WordReveal
        text="A reforma vai mudar o resultado de toda empresa brasileira. A diferença está em quem antecipa — e quem só descobre depois."
        className="relative mx-auto max-w-4xl text-balance text-center text-2xl font-semibold leading-snug tracking-tight md:text-4xl"
      />
    </section>
  )
}

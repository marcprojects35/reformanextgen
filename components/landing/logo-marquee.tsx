'use client'

const items = [
  'CONTABILIDADE PRIME',
  'GRUPO VANGUARDA',
  'NEXUS INDÚSTRIA',
  'ATLAS LOGÍSTICA',
  'MERIDIAN RETAIL',
  'CONSTRUTORA ORION',
  'AGRO HORIZONTE',
  'FISCAL ONE',
]

export function LogoMarquee() {
  return (
    <section className="border-y border-border bg-surface/60 py-10">
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Empresas e escritórios contábeis que já se preparam
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="animate-scroll-x flex w-max items-center gap-14">
          {[...items, ...items].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="whitespace-nowrap text-sm font-semibold tracking-tight text-muted-foreground/70"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

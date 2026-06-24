'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Reveal } from './reveal'
import { Parallax } from './parallax'
import { MagneticButton } from './magnetic-button'

type FooterLink = { label: string; href: string }

const footerLinks: Record<string, FooterLink[]> = {
  Produto: [
    { label: 'Simulador', href: '/simulacao/novo' },
    { label: 'Como funciona', href: '/#como-funciona' },
    { label: 'Impactos', href: '/#impactos' },
    { label: 'Planos', href: '/#planos' },
  ],
  Empresa: [
    { label: 'Cases', href: '/#cases' },
    { label: 'Contato', href: 'mailto:contato@reformanextgen.com.br' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Criar conta', href: '/cadastro' },
  ],
  Legal: [
    { label: 'Privacidade', href: '/privacidade' },
    { label: 'Termos de Uso', href: '/termos' },
    { label: 'LGPD', href: '/privacidade#seus-direitos' },
  ],
}

export function CtaFooter() {
  return (
    <>
      <section id="cta" className="relative overflow-hidden px-4 py-24 md:py-32">
        <Parallax
          speed={40}
          className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
        >
          <div
            className="h-full w-full rounded-full"
            style={{ background: 'rgba(255,180,0,0.16)' }}
          />
        </Parallax>
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-6xl">
            A reforma não vai esperar.{' '}
            <span className="text-gradient-gold">Sua empresa também não deveria.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground md:text-lg">
            Comece a simular agora e tenha em minutos a clareza que sua operação
            precisa para os próximos anos.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MagneticButton className="inline-flex">
              <a
                href="/cadastro"
                className="btn-shine glow-gold group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                Criar minha conta
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </MagneticButton>
            <a
              href="#demonstracao"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Agendar demonstração
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border bg-surface/60 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Reforma NextGen"
                  width={36}
                  height={36}
                  className="h-9 w-9"
                />
                <span className="text-base font-semibold tracking-tight">
                  Reforma<span className="text-primary">NextGen</span>
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Análise inteligente da Reforma Tributária Brasileira.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, items]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold">{title}</h4>
                <ul className="mt-4 flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-center border-t border-border pt-8 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} ReformaNextGen. Todos os direitos reservados.</p>
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="h-3 w-px bg-border" aria-hidden />
            Desenvolvido por{' '}
            <a
              href="https://www.linkedin.com/in/marcoaurelioprudencio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              marco
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}

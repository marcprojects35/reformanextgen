import Image from 'next/image'
import Link from 'next/link'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
  wide?: boolean
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16">
      <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
      <div
        className="absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.16), transparent 70%)' }}
        aria-hidden
      />

      <div className={`relative w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="Reforma NextGen" width={36} height={36} className="h-9 w-9" />
          <span className="text-base font-semibold tracking-tight">
            Reforma<span className="text-primary">NextGen</span>
          </span>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-8">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </main>
  )
}

import { Mail, ShieldCheck, Building2 } from 'lucide-react'

import { SpotlightCard } from '@/components/landing/spotlight-card'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function AccountHeader({
  name,
  email,
  logo,
  companyName,
  regime,
}: {
  name: string
  email: string
  logo?: string | null
  companyName?: string
  regime?: string
}) {
  return (
    <SpotlightCard className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/25 to-primary/5 text-lg font-bold text-primary">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight">{name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {email}
          </p>
        </div>

        {companyName && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-accent/40 px-3 py-2 text-xs">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="max-w-[14rem] truncate font-medium text-foreground">{companyName}</p>
              {regime && <p className="text-muted-foreground">{regime}</p>}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        O e-mail não pode ser alterado após o cadastro.
      </p>
    </SpotlightCard>
  )
}

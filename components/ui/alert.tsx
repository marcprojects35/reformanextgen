import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary/40 text-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        success: 'border-success/30 bg-success/10 text-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const icons = {
  default: Info,
  destructive: AlertTriangle,
  success: CheckCircle2,
}

function Alert({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  const Icon = icons[variant ?? 'default']
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export { Alert, alertVariants }

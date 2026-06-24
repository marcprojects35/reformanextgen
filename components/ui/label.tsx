import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'mb-1.5 block text-sm font-medium text-foreground/90',
        className,
      )}
      {...props}
    />
  )
}

export { Label }

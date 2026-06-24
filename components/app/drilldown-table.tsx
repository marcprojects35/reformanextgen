import type { DrillDownRow } from '@/lib/tax-engine/types'
import { formatCurrencyBRL, formatPercent } from '@/lib/labels'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function DrillDownTable({
  rows,
  emptyLabel,
  valueLabel = 'Receita',
}: {
  rows: DrillDownRow[]
  emptyLabel: string
  valueLabel?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">{valueLabel}</TableHead>
          <TableHead className="text-right">% do total</TableHead>
          <TableHead className="text-right">Tributos atuais</TableHead>
          <TableHead className="text-right">Tributos com reforma</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.chave}>
            <TableCell className="max-w-[220px] truncate font-medium" title={row.label}>
              {row.label}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrencyBRL(row.receita)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatPercent(row.percentualReceita)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrencyBRL(row.tributosAtuais)}</TableCell>
            <TableCell className="text-right tabular-nums text-primary">
              {formatCurrencyBRL(row.tributosReforma)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

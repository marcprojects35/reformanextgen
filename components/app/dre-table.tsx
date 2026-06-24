import type { YearlyProjection } from '@/lib/tax-engine/types'
import { formatCurrencyBRL, formatPercent } from '@/lib/labels'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function DreTable({ anos, label }: { anos: YearlyProjection[]; label: string }) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Projeção ano a ano para <span className="font-medium text-foreground">{label}</span>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ano</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Tributos (sistema atual)</TableHead>
            <TableHead className="text-right">Tributos (com reforma)</TableHead>
            <TableHead className="text-right">Carga atual</TableHead>
            <TableHead className="text-right">Carga c/ reforma</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anos.map((ano) => (
            <TableRow key={ano.ano}>
              <TableCell className="font-medium">{ano.ano}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrencyBRL(ano.receita)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrencyBRL(ano.tributosAtuais)}</TableCell>
              <TableCell className="text-right tabular-nums text-primary">
                {formatCurrencyBRL(ano.tributosReforma)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(ano.cargaAtualPct)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(ano.cargaReformaPct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

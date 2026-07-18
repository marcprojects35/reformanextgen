import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PublicReportWrapper } from '@/components/public-report-wrapper'

export const metadata: Metadata = {
  title: 'Análise de Impacto | Reforma NextGen',
  description: 'Análise de impacto da Reforma Tributária Brasileira',
}

export default async function PublicRelatorioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        }
      >
        <PublicReportWrapper token={token} />
      </Suspense>
    </div>
  )
}

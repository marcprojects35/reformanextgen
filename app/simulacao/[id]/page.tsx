import { redirect } from 'next/navigation'

export default async function SimulacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/simulacao/${id}/resultado`)
}

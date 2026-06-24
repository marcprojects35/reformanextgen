import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { deleteSimulation, getSimulationWithCompany } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const simulationId = Number(id)
  if (!Number.isFinite(simulationId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const simulation = getSimulationWithCompany(simulationId, user.id)
  if (!simulation) return NextResponse.json({ error: 'Não encontrada.' }, { status: 404 })

  return NextResponse.json({ simulation })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const simulationId = Number(id)
  if (!Number.isFinite(simulationId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const simulation = getSimulationWithCompany(simulationId, user.id)
  if (!simulation) {
    return NextResponse.json({ error: 'Simulação não encontrada.' }, { status: 404 })
  }

  deleteSimulation(simulationId)
  return NextResponse.json({ ok: true })
}

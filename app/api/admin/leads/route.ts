import { NextResponse } from 'next/server'

import { isAdminAuthed } from '@/lib/admin-auth'
import { listDiagnosticLeads } from '@/lib/db-admin'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  return NextResponse.json({ leads: listDiagnosticLeads() })
}

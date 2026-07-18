import { cookies } from 'next/headers'

import { listCompaniesByUser, type CompanyRow } from '@/lib/db'
import { getEmpresaByAppUserId } from '@/lib/db-admin'

export const ACTIVE_COMPANY_COOKIE = 'active_company'
const ACTIVE_COMPANY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/**
 * Empresa (companies/app.db) marcada como ativa pelo cliente em "Minha conta".
 * Cai para a primeira cadastrada se o cookie não existir ou apontar para uma
 * empresa de outro usuário/já removida — mesmo comportamento de antes de
 * existir seleção (sempre a primeira).
 */
export async function getSelectedCompany(
  userId: number,
  companies?: CompanyRow[],
): Promise<CompanyRow | null> {
  const list = companies ?? listCompaniesByUser(userId)
  if (list.length === 0) return null

  const store = await cookies()
  const rawId = Number(store.get(ACTIVE_COMPANY_COOKIE)?.value)
  return list.find((c) => c.id === rawId) ?? list[0]
}

/**
 * Id da empresa administrativa (empresas/admin.db) cujos relatórios devem
 * aparecer no dashboard do cliente. Se o usuário não tem nenhuma CompanyRow
 * própria (caso legado: login criado pelo admin direto em cima de uma
 * empresa já existente, sem passar pelo cadastro do cliente), cai para
 * getEmpresaByAppUserId — preserva o comportamento anterior a este recurso.
 */
export async function getActiveEmpresaId(userId: number): Promise<number | null> {
  const selected = await getSelectedCompany(userId)
  if (selected) return selected.admin_empresa_id
  return getEmpresaByAppUserId(userId)?.id ?? null
}

export async function setActiveCompanyCookie(companyId: number) {
  const store = await cookies()
  store.set(ACTIVE_COMPANY_COOKIE, String(companyId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACTIVE_COMPANY_MAX_AGE_SECONDS,
  })
}

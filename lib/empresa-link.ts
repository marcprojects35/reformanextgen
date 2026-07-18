import { getCompanyById, updateCompany, setCompanyAdminEmpresaId, type CompanyRow } from '@/lib/db'
import { createEmpresaCliente, findEmpresaByCnpj, getEmpresa, linkEmpresaToAppUser, updateEmpresa } from '@/lib/db-admin'
import { regimeAtualLabels } from '@/lib/labels'

/**
 * Único ponto do código que conhece as duas bases (app.db e admin.db).
 * Chamado depois que um cliente cadastra sua empresa: garante que ela apareça
 * para o admin, seja vinculando a uma empresa já existente (criada manualmente
 * pelo admin, mesmo CNPJ) ou criando uma nova, marcada como origem='cliente'.
 */
export function linkClienteCompanyToEmpresa(company: CompanyRow, userId: number): number {
  const cnpjDigits = (company.cnpj ?? '').replace(/\D/g, '')
  const existente = cnpjDigits ? findEmpresaByCnpj(cnpjDigits) : null

  let empresaId: number
  if (existente && !existente.app_user_id) {
    linkEmpresaToAppUser(existente.id, { appUserId: userId, appCompanyId: company.id })
    empresaId = existente.id
  } else {
    empresaId = createEmpresaCliente({
      nome: company.razao_social,
      cnpj: company.cnpj,
      regime: regimeAtualLabels[company.regime_atual],
      appUserId: userId,
      appCompanyId: company.id,
    })
  }

  setCompanyAdminEmpresaId(company.id, empresaId)
  return empresaId
}

/**
 * Chamado sempre que o cliente edita os dados da própria empresa (via /conta).
 * Mantém nome/CNPJ/regime/logo da empresa (admin.db) espelhando o que o
 * cliente salvou em companies (app.db) — sem isso, o admin continuaria vendo
 * os dados antigos mesmo depois de o cliente atualizar o cadastro.
 */
export function syncCompanyToEmpresa(companyId: number): void {
  const company = getCompanyById(companyId)
  if (!company?.admin_empresa_id) return

  updateEmpresa(company.admin_empresa_id, {
    nome: company.razao_social,
    cnpj: company.cnpj ?? '',
    regime: regimeAtualLabels[company.regime_atual],
    logo: company.logo,
  })
}

/**
 * Chamado sempre que o admin edita a logo de uma empresa (via /admin/empresas).
 * A logo é o único campo em que o admin também pode ser a origem da alteração
 * (ex.: o cliente ainda não subiu uma, ou o admin corrigiu uma logo errada) —
 * por isso, ao contrário de nome/CNPJ/regime, ela precisa sincronizar nos dois
 * sentidos. Sem isso, o cliente continuaria vendo "Enviar logo" em /conta
 * mesmo depois de o admin já ter cadastrado uma.
 */
export function syncEmpresaLogoToCompany(empresaId: number): void {
  const empresa = getEmpresa(empresaId)
  if (!empresa?.app_company_id) return

  updateCompany(empresa.app_company_id, { logo: empresa.logo || null })
}

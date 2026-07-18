import { getCachedCnpjNomes, setCachedCnpjNome } from './db-admin'
import type { AdminReportV2 } from './admin-engine'

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

interface BrasilApiCnpjResponse {
  razao_social?: string
  nome_fantasia?: string
}

async function fetchNomeFromApi(cnpjDigits: string): Promise<string | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
      signal: AbortSignal.timeout(5000),
      // A BrasilAPI bloqueia (403) requests sem User-Agent — fetch nativo do Node não envia um por padrão.
      headers: { 'User-Agent': 'ReformaNextGen/1.0 (consulta-cnpj)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as BrasilApiCnpjResponse
    return data.nome_fantasia?.trim() || data.razao_social?.trim() || null
  } catch {
    return null
  }
}

/**
 * Resolve o nome da empresa a partir do CNPJ: primeiro olha o cache local
 * (SQLite), e só consulta a BrasilAPI (dados públicos da Receita Federal)
 * para os CNPJs ainda não vistos. Roda com concorrência limitada e um
 * orçamento de tempo total — se estourar o prazo, para de tentar e deixa o
 * restante para o cache resolver numa próxima importação.
 *
 * Retorna um Map da string de CNPJ ORIGINAL (como veio da planilha, com
 * eventual aspas simples/pontuação) → nome encontrado. CNPJs sem nome
 * encontrado não entram no Map — quem chama deve manter o CNPJ como fallback.
 */
export async function resolveCnpjNomes(
  rawCnpjs: string[],
  opts?: { budgetMs?: number; concurrency?: number },
): Promise<Map<string, string>> {
  const budgetMs = opts?.budgetMs ?? 25000
  const concurrency = opts?.concurrency ?? 4
  const deadline = Date.now() + budgetMs

  const result = new Map<string, string>()
  const rawByDigits = new Map<string, string[]>()

  for (const raw of rawCnpjs) {
    const digits = onlyDigits(raw)
    if (digits.length !== 14) continue
    const arr = rawByDigits.get(digits) ?? []
    arr.push(raw)
    rawByDigits.set(digits, arr)
  }

  const uniqueDigits = [...rawByDigits.keys()]
  if (uniqueDigits.length === 0) return result

  const cached = getCachedCnpjNomes(uniqueDigits)
  const toFetch: string[] = []
  for (const digits of uniqueDigits) {
    if (cached.has(digits)) {
      const nome = cached.get(digits)
      if (nome) for (const raw of rawByDigits.get(digits)!) result.set(raw, nome)
    } else {
      toFetch.push(digits)
    }
  }

  let idx = 0
  async function worker() {
    while (idx < toFetch.length && Date.now() < deadline) {
      const digits = toFetch[idx++]
      const nome = await fetchNomeFromApi(digits)
      setCachedCnpjNome(digits, nome)
      if (nome) for (const raw of rawByDigits.get(digits)!) result.set(raw, nome)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, toFetch.length) }, () => worker()))

  return result
}

/**
 * Resolve o nome (razão social/nome fantasia) de fornecedores, clientes e
 * fornecedores do Simples a partir do CNPJ. Roda uma vez, no momento da
 * importação — o relatório salvo já guarda o nome, sem precisar consultar
 * de novo depois. Só é usada em código de servidor (rota de import).
 */
export async function enrichReportComNomesDeCnpj(report: AdminReportV2): Promise<void> {
  const todosCnpjs = [
    ...report.comprasFornecedores.map(f => f.cnpj),
    ...report.vendasClientes.map(v => v.codigo),
    ...report.comprasSimples.map(s => s.cnpj),
  ]
  const nomes = await resolveCnpjNomes(todosCnpjs)
  if (nomes.size === 0) return
  for (const f of report.comprasFornecedores) {
    const nome = nomes.get(f.cnpj)
    if (nome) f.nome = nome
  }
  for (const v of report.vendasClientes) {
    const nome = nomes.get(v.codigo)
    if (nome) v.nome = nome
  }
  for (const s of report.comprasSimples) {
    const nome = nomes.get(s.cnpj)
    if (nome) s.nome = nome
  }
}

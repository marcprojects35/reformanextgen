// Sugere uma categoria mercadológica (lib/merc-categorias.ts) a partir da
// descrição livre de um item de compra/venda (NCM ou serviço). É uma
// aproximação por similaridade de texto — não substitui uma classificação
// manual/oficial, mas dá um agrupamento útil onde hoje só existe o NCM cru.
import { listFamilias, getCaminho, type CategoriaComCaminho } from '@/lib/merc-categorias'

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'para',
  'com', 'sem', 'ou', 'un', 'kg', 'ml', 'gr', 'und', 'unid', 'cx', 'pct',
])

function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

interface Indexado {
  codigo: string
  tokens: Set<string>
}

let indice: Indexado[] | null = null

function getIndice(): Indexado[] {
  if (!indice) {
    indice = listFamilias().map(f => ({
      codigo: f.codigo,
      tokens: new Set(normalizar(f.descricao)),
    }))
  }
  return indice
}

/**
 * Retorna a Família com maior sobreposição de tokens com a descrição, desde
 * que pelo menos 1 palavra relevante bata — abaixo disso o palpite é ruim
 * demais pra valer a pena mostrar.
 */
export function sugerirCategoriaMercadologica(descricao: string | undefined | null): CategoriaComCaminho | undefined {
  if (!descricao) return undefined
  const tokens = normalizar(descricao)
  if (tokens.length === 0) return undefined

  let melhorCodigo: string | undefined
  let melhorScore = 0

  for (const item of getIndice()) {
    let score = 0
    for (const t of tokens) if (item.tokens.has(t)) score++
    if (score > melhorScore) {
      melhorScore = score
      melhorCodigo = item.codigo
    }
  }

  if (!melhorCodigo || melhorScore < 1) return undefined
  return getCaminho(melhorCodigo)
}

/**
 * Mesma coisa que sugerirCategoriaMercadologica, mas com duas fontes melhores que o palpite
 * por texto, em ordem de prioridade:
 * 1. `overrideCodigo` — correção manual do admin (lib/db-admin.ts: ncm_categoria_overrides).
 * 2. `codigoReal` — classificação real vinda da planilha mercadológica do cliente (ex.: "LJ 01",
 *    ver lib/admin-engine.ts: parseMercadologicaClassificacao), casada por codigo_produto — não
 *    é palpite, é o dado correto informado pelo próprio cliente.
 * Só cai pra similaridade de texto quando nenhuma das duas está disponível pro produto.
 */
export function resolverCategoriaMercadologica(
  descricao: string | undefined | null,
  overrideCodigo: string | undefined | null,
  codigoReal?: string | undefined | null,
): CategoriaComCaminho | undefined {
  if (overrideCodigo) {
    const cat = getCaminho(overrideCodigo)
    if (cat) return cat
  }
  if (codigoReal) {
    const cat = getCaminho(codigoReal)
    if (cat) return cat
  }
  return sugerirCategoriaMercadologica(descricao)
}

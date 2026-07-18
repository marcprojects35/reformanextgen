// Taxonomia de classificação mercadológica (Seção > Grupo > Subgrupo > Família),
// importada de "Estrutura Mercadologica Ctrib - correta certa.xlsx" via
// scripts/gerar-estrutura-mercadologica.mjs. Serve pra agrupar produtos (NCM)
// por categoria de mercado — útil porque a reforma tributária dá tratamento
// diferenciado por categoria (cesta básica, saúde, agropecuária etc.), algo que
// o NCM sozinho não deixa evidente num relatório.
import data from '@/lib/data/estrutura-mercadologica.json'

export type NivelMercadologico = 'secao' | 'grupo' | 'subgrupo' | 'familia'

export interface CategoriaMercadologica {
  codigo: string
  descricao: string
  nivel: NivelMercadologico
  parentCodigo: string | null
}

export interface CategoriaComCaminho extends CategoriaMercadologica {
  /** Ex.: "Alimentos > Mercearia Seca > Cereais (GRUPO) > Arroz Integral" */
  caminho: string
  secao: string
}

export interface CategoriaNode extends CategoriaMercadologica {
  filhos: CategoriaNode[]
}

const CATEGORIAS = data as CategoriaMercadologica[]

const byCodigo = new Map<string, CategoriaMercadologica>()
for (const c of CATEGORIAS) byCodigo.set(c.codigo, c)

export function listMercCategorias(): CategoriaMercadologica[] {
  return CATEGORIAS
}

export function getMercCategoria(codigo: string): CategoriaMercadologica | undefined {
  return byCodigo.get(codigo)
}

/** Só as Famílias (nível folha) — é o nível usado pra classificar um produto/NCM. */
export function listFamilias(): CategoriaMercadologica[] {
  return CATEGORIAS.filter(c => c.nivel === 'familia')
}

export function getCaminho(codigo: string): CategoriaComCaminho | undefined {
  const cat = byCodigo.get(codigo)
  if (!cat) return undefined
  const partes: string[] = [cat.descricao]
  let atual = cat
  while (atual.parentCodigo) {
    const pai = byCodigo.get(atual.parentCodigo)
    if (!pai) break
    partes.unshift(pai.descricao)
    atual = pai
  }
  return { ...cat, caminho: partes.join(' > '), secao: partes[0] }
}

/** Árvore completa Seção → Grupo → Subgrupo → Família, pra navegação/admin. */
export function getMercCategoriasTree(): CategoriaNode[] {
  const nodes = new Map<string, CategoriaNode>()
  for (const c of CATEGORIAS) nodes.set(c.codigo, { ...c, filhos: [] })

  const roots: CategoriaNode[] = []
  for (const node of nodes.values()) {
    if (node.parentCodigo) {
      nodes.get(node.parentCodigo)?.filhos.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Item com valores AR/DR já agregados (ex.: uma linha de ComprasNCMRow/VendasDetalheRow) — o
 *  suficiente pra agrupar por categoria mercadológica sem depender do lib/admin-engine.ts
 *  (que importa `xlsx` e não deve ser puxado pra bundles de cliente). ComprasNCMRow expõe
 *  custoAR/custoDR mas não diffCusto; VendasDetalheRow é o oposto — por isso os três são opcionais
 *  e o rollup deriva o que faltar. */
export interface ItemComCategoriaMercadologica {
  valorAR: number
  valorDR: number
  custoAR?: number
  custoDR?: number
  diffCusto?: number
  cargaARPct: number
  cargaDRPct: number
  categoriaMercadologica?: CategoriaComCaminho
}

export interface CategoriaMercadologicaRow {
  categoria: string
  valorAR: number
  valorDR: number
  custoAR: number
  custoDR: number
  cargaARPct: number
  cargaDRPct: number
  diffCusto: number
  count: number
}

const SEM_CATEGORIA = 'Não Classificado'

/** Agrupa itens (linhas de NCM) por Seção mercadológica — usado tanto na geração do
 *  relatório (lib/admin-engine.ts) quanto no cliente, pra recalcular na hora depois de uma
 *  correção manual de categoria, sem precisar reprocessar a planilha inteira. */
export function computeCategoriaMercadologicaRollup(itens: ItemComCategoriaMercadologica[]): CategoriaMercadologicaRow[] {
  interface Acc extends CategoriaMercadologicaRow { cargaARWSum: number; cargaDRWSum: number }
  const porSecao = new Map<string, Acc>()

  for (const item of itens) {
    if (item.valorAR <= 0 && item.valorDR <= 0) continue
    const categoria = item.categoriaMercadologica?.secao ?? SEM_CATEGORIA
    const acc = porSecao.get(categoria) ?? {
      categoria, valorAR: 0, valorDR: 0, custoAR: 0, custoDR: 0,
      cargaARPct: 0, cargaDRPct: 0, diffCusto: 0, count: 0, cargaARWSum: 0, cargaDRWSum: 0,
    }
    const custoAR = item.custoAR ?? 0
    const custoDR = item.custoDR ?? 0
    acc.valorAR += item.valorAR
    acc.valorDR += item.valorDR
    acc.custoAR += custoAR
    acc.custoDR += custoDR
    acc.diffCusto += item.diffCusto ?? (custoDR - custoAR)
    acc.cargaARWSum += item.cargaARPct * item.valorAR
    acc.cargaDRWSum += item.cargaDRPct * item.valorDR
    acc.count += 1
    porSecao.set(categoria, acc)
  }

  return Array.from(porSecao.values())
    .map(({ cargaARWSum, cargaDRWSum, ...row }) => ({
      ...row,
      cargaARPct: row.valorAR > 0 ? cargaARWSum / row.valorAR : 0,
      cargaDRPct: row.valorDR > 0 ? cargaDRWSum / row.valorDR : 0,
    }))
    .sort((a, b) => b.valorAR - a.valorAR)
}

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { resumoPeriodo, anoDoPeriodo, type AdminReportV2 } from '@/lib/admin-engine'

const DB_DIR = path.join(process.cwd(), 'data')
mkdirSync(DB_DIR, { recursive: true })
const DB_PATH = path.join(DB_DIR, 'admin.db')

let _db: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH)
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa TEXT NOT NULL,
        cnpj TEXT DEFAULT '',
        regime TEXT DEFAULT '',
        periodo TEXT NOT NULL,
        report_json TEXT NOT NULL,
        share_token TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admin_reports_periodo ON admin_reports(periodo);
      CREATE INDEX IF NOT EXISTS idx_admin_reports_empresa ON admin_reports(empresa);

      CREATE TABLE IF NOT EXISTS empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cnpj TEXT DEFAULT '',
        regime TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_empresas_nome ON empresas(nome);

      CREATE TABLE IF NOT EXISTS cnpj_cache (
        cnpj TEXT PRIMARY KEY,
        nome TEXT,
        fetched_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS report_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL REFERENCES admin_reports(id),
        author_type TEXT NOT NULL,
        author_user_id INTEGER,
        author_label TEXT,
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);

      CREATE TABLE IF NOT EXISTS ncm_categoria_overrides (
        ncm TEXT PRIMARY KEY,
        categoria_codigo TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS diagnostic_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT,
        telefone TEXT,
        setor TEXT NOT NULL,
        regime_atual TEXT NOT NULL,
        faturamento_anual REAL NOT NULL,
        margem_lucro REAL,
        resultado_json TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_diagnostic_leads_created ON diagnostic_leads(created_at);

      CREATE TABLE IF NOT EXISTS dashboard_textos (
        empresa_id INTEGER NOT NULL,
        chave TEXT NOT NULL,
        valor TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (empresa_id, chave)
      );

      CREATE TABLE IF NOT EXISTS produto_categoria_cache (
        empresa_id INTEGER NOT NULL,
        codigo_produto TEXT NOT NULL,
        categoria_codigo TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (empresa_id, codigo_produto)
      );
    `)
    try { _db.exec('ALTER TABLE admin_reports ADD COLUMN share_token TEXT') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE admin_reports ADD COLUMN empresa_id INTEGER') } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN nome_fantasia TEXT DEFAULT ''") } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN telefone TEXT DEFAULT ''") } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN responsavel TEXT DEFAULT ''") } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN endereco TEXT DEFAULT ''") } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN ramo TEXT DEFAULT ''") } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE empresas ADD COLUMN logo TEXT') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE empresas ADD COLUMN app_user_id INTEGER') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE empresas ADD COLUMN app_company_id INTEGER') } catch { /* already exists */ }
    try { _db.exec("ALTER TABLE empresas ADD COLUMN origem TEXT DEFAULT 'admin'") } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE admin_reports ADD COLUMN visible_to_client INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE admin_reports ADD COLUMN sent_at TEXT') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE report_comments ADD COLUMN section TEXT') } catch { /* already exists */ }
    // `lote` = mês/ano REAL em que a análise inteira (os 8 anos de transição) foi importada
    // (ex. "2026-07"). Diferente de `periodo`, que é o ano da transição da reforma
    // ("2026-01".."2033-01") — todas as 8 planilhas de uma mesma análise compartilham o
    // mesmo `lote`. Ver lib/db-admin.ts getEmpresaAnalises().
    try { _db.exec('ALTER TABLE admin_reports ADD COLUMN lote TEXT') } catch { /* already exists */ }
  }
  return _db
}

export interface AdminReportRow {
  id: number
  empresa: string
  cnpj: string
  regime: string
  periodo: string
  report_json: string
  created_at: string
  empresa_id: number | null
  visible_to_client: number
  sent_at: string | null
  lote: string | null
}

/**
 * Salva um relatório importado. Quando `empresaId` e `lote` vêm preenchidos (import multi-ano
 * normal), faz upsert por (empresa_id, periodo, lote): reimportar o mesmo ano da mesma análise
 * substitui o relatório existente (preserva o `id`, e com ele `share_token`/`report_comments`/
 * `visible_to_client`) em vez de criar uma linha duplicada no histórico. Sem empresaId/lote
 * (import single-file legado) sempre insere, como antes.
 */
export function saveAdminReport(data: {
  empresa: string
  cnpj: string
  regime: string
  periodo: string
  reportJson: string
  empresaId?: number | null
  lote?: string | null
}): number {
  const db = getDb()

  if (data.empresaId && data.lote) {
    const existing = db.prepare(
      'SELECT id FROM admin_reports WHERE empresa_id = ? AND periodo = ? AND lote = ?',
    ).get(data.empresaId, data.periodo, data.lote) as { id: number } | undefined

    if (existing) {
      db.prepare(`
        UPDATE admin_reports
        SET empresa = ?, cnpj = ?, regime = ?, report_json = ?, created_at = datetime('now')
        WHERE id = ?
      `).run(data.empresa, data.cnpj, data.regime, data.reportJson, existing.id)
      invalidateParsedReportCache(existing.id)
      // Reimportar qualquer ano do lote pode mudar o overlay de dados reais dos anos-irmãos
      // (`enrichReportComDadosReais` usa TODOS os relatórios do lote) — invalida o cache
      // computado de todos eles, não só o que foi reimportado.
      const irmaos = db.prepare(
        'SELECT id FROM admin_reports WHERE empresa_id = ? AND lote = ?',
      ).all(data.empresaId, data.lote) as { id: number }[]
      for (const irmao of irmaos) invalidateComputedReportCache(irmao.id)
      return existing.id
    }
  }

  const stmt = db.prepare(`
    INSERT INTO admin_reports (empresa, cnpj, regime, periodo, report_json, empresa_id, lote)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.empresa, data.cnpj, data.regime, data.periodo, data.reportJson,
    data.empresaId ?? null, data.lote ?? null,
  )
  return result.lastInsertRowid as number
}

export function listAdminReports(filters?: {
  empresa?: string
  periodoInicio?: string
  periodoFim?: string
  empresaId?: number
}): Omit<AdminReportRow, 'report_json'>[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.empresa) {
    conditions.push('empresa LIKE ?')
    params.push(`%${filters.empresa}%`)
  }
  if (filters?.periodoInicio) {
    conditions.push('periodo >= ?')
    params.push(filters.periodoInicio)
  }
  if (filters?.periodoFim) {
    conditions.push('periodo <= ?')
    params.push(filters.periodoFim)
  }
  if (filters?.empresaId) {
    conditions.push('empresa_id = ?')
    params.push(filters.empresaId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const stmt = db.prepare(
    `SELECT id, empresa, cnpj, regime, periodo, created_at, empresa_id FROM admin_reports ${where} ORDER BY periodo DESC, created_at DESC`
  )
  return stmt.all(...params) as Omit<AdminReportRow, 'report_json'>[]
}

// ─── Empresas ───────────────────────────────────────────────────────────────

export interface EmpresaRow {
  id: number
  nome: string
  cnpj: string
  regime: string
  nome_fantasia: string
  telefone: string
  responsavel: string
  endereco: string
  ramo: string
  logo: string | null
  app_user_id: number | null
  app_company_id: number | null
  origem: 'admin' | 'cliente'
  created_at: string
}

export interface EmpresaComStats extends EmpresaRow {
  totalRelatorios: number
  ultimoPeriodo: string | null
}

const EMPRESA_COLS = 'id, nome, cnpj, regime, nome_fantasia, telefone, responsavel, endereco, ramo, logo, app_user_id, app_company_id, origem, created_at'

export function createEmpresa(data: { nome: string; cnpj?: string; regime?: string }): number {
  const db = getDb()
  const stmt = db.prepare('INSERT INTO empresas (nome, cnpj, regime) VALUES (?, ?, ?)')
  const result = stmt.run(data.nome, data.cnpj ?? '', data.regime ?? '')
  return result.lastInsertRowid as number
}

export function createEmpresaCliente(data: {
  nome: string
  cnpj?: string | null
  regime?: string | null
  appUserId: number
  appCompanyId: number
}): number {
  const db = getDb()
  const stmt = db.prepare(
    "INSERT INTO empresas (nome, cnpj, regime, app_user_id, app_company_id, origem) VALUES (?, ?, ?, ?, ?, 'cliente')",
  )
  const result = stmt.run(data.nome, data.cnpj ?? '', data.regime ?? '', data.appUserId, data.appCompanyId)
  return result.lastInsertRowid as number
}

/** Busca por CNPJ ignorando pontuação (compara só os dígitos, já que o campo é digitado livremente). */
export function findEmpresaByCnpj(cnpjDigits: string): EmpresaRow | null {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT ${EMPRESA_COLS} FROM empresas
    WHERE cnpj != '' AND REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ?
    ORDER BY id ASC LIMIT 1
  `)
  return (stmt.get(cnpjDigits) as EmpresaRow) ?? null
}

export function linkEmpresaToAppUser(empresaId: number, data: { appUserId: number; appCompanyId?: number | null }) {
  const db = getDb()
  db.prepare('UPDATE empresas SET app_user_id = ?, app_company_id = ? WHERE id = ?')
    .run(data.appUserId, data.appCompanyId ?? null, empresaId)
}

export function getEmpresaByAppUserId(appUserId: number): EmpresaRow | null {
  const db = getDb()
  const stmt = db.prepare(`SELECT ${EMPRESA_COLS} FROM empresas WHERE app_user_id = ? LIMIT 1`)
  return (stmt.get(appUserId) as EmpresaRow) ?? null
}

export function updateEmpresa(id: number, data: Partial<{
  nome: string; cnpj: string; regime: string; nomeFantasia: string; telefone: string
  responsavel: string; endereco: string; ramo: string; logo: string | null
}>): boolean {
  const db = getDb()
  const colMap: Record<string, string> = {
    nome: 'nome', cnpj: 'cnpj', regime: 'regime', nomeFantasia: 'nome_fantasia',
    telefone: 'telefone', responsavel: 'responsavel', endereco: 'endereco', ramo: 'ramo', logo: 'logo',
  }
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, col] of Object.entries(colMap)) {
    if (key in data) {
      sets.push(`${col} = ?`)
      params.push((data as Record<string, unknown>)[key] ?? '')
    }
  }
  if (!sets.length) return false
  params.push(id)
  const stmt = db.prepare(`UPDATE empresas SET ${sets.join(', ')} WHERE id = ?`)
  const result = stmt.run(...params)
  return (result.changes as number) > 0
}

export function listEmpresas(): EmpresaComStats[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT e.id, e.nome, e.cnpj, e.regime, e.nome_fantasia, e.telefone, e.responsavel,
      e.endereco, e.ramo, e.logo, e.app_user_id, e.app_company_id, e.origem, e.created_at,
      COUNT(r.id) as totalRelatorios,
      MAX(r.periodo) as ultimoPeriodo
    FROM empresas e
    LEFT JOIN admin_reports r ON r.empresa_id = e.id
    GROUP BY e.id
    ORDER BY e.nome ASC
  `)
  return stmt.all() as EmpresaComStats[]
}

export function getEmpresa(id: number): EmpresaRow | null {
  const db = getDb()
  const stmt = db.prepare(`SELECT ${EMPRESA_COLS} FROM empresas WHERE id = ?`)
  return (stmt.get(id) as EmpresaRow) ?? null
}

export function getEmpresaReports(empresaId: number): Omit<AdminReportRow, 'report_json'>[] {
  const db = getDb()
  const stmt = db.prepare(
    `SELECT id, empresa, cnpj, regime, periodo, created_at, empresa_id, lote FROM admin_reports WHERE empresa_id = ? ORDER BY periodo ASC, created_at ASC`
  )
  return stmt.all(empresaId) as Omit<AdminReportRow, 'report_json'>[]
}

export interface EmpresaAnalise {
  /** Mês/ano real da análise (ex. "2026-07"), ou o próprio `periodo` como fallback isolado
   *  pra relatórios salvos antes desse campo existir. */
  lote: string
  /** reportId por ano da transição (2026..2033) dentro dessa análise. */
  reportIdPorAno: Record<number, number>
  createdAt: string
  resultadoAR: number | null
  resultadoDR: number | null
}

/**
 * Agrupa os relatórios de uma empresa por análise (mesmo `lote`) — os 8 anos da transição
 * (2026-2033) importados juntos viram 1 grupo só, em vez de 8 linhas soltas no histórico.
 * `resultadoAR` vem do ano-base (2026) do grupo, `resultadoDR` do último ano disponível — o
 * AR não varia de verdade entre os anos de uma mesma análise (ver overlayARComBaseline em
 * lib/projecao-real.ts), então não faz sentido mostrar um AR "por ano" no resumo.
 */
export function getEmpresaAnalises(empresaId: number): EmpresaAnalise[] {
  const rows = getEmpresaReports(empresaId)
  const grupos = new Map<string, typeof rows>()

  for (const r of rows) {
    // Sem lote (relatório salvo antes dessa feature) — cada um vira seu próprio grupo isolado
    // pelo periodo, pra não misturar análises diferentes sem informação de agrupamento real.
    const chave = r.lote ?? `legacy:${r.periodo}:${r.id}`
    const grupo = grupos.get(chave) ?? []
    grupo.push(r)
    grupos.set(chave, grupo)
  }

  const analises: EmpresaAnalise[] = []
  for (const [chave, grupo] of grupos) {
    const reportIdPorAno: Record<number, number> = {}
    for (const r of grupo) {
      const ano = anoDoPeriodo(r.periodo)
      if (Number.isFinite(ano)) reportIdPorAno[ano] = r.id
    }
    const anosOrdenados = Object.keys(reportIdPorAno).map(Number).sort((a, b) => a - b)
    if (!anosOrdenados.length) continue

    const anoBase = anosOrdenados[0]
    const anoFinal = anosOrdenados[anosOrdenados.length - 1]
    const reportBase = getAdminReport(reportIdPorAno[anoBase])
    const reportFinal = getAdminReport(reportIdPorAno[anoFinal])
    const resumoBase = reportBase ? resumoPeriodo(JSON.parse(reportBase.report_json) as AdminReportV2) : null
    const resumoFinal = reportFinal ? resumoPeriodo(JSON.parse(reportFinal.report_json) as AdminReportV2) : null

    analises.push({
      lote: grupo[0].lote ?? grupo[0].periodo,
      reportIdPorAno,
      createdAt: grupo.map(r => r.created_at).sort().at(-1)!,
      resultadoAR: resumoBase?.resultadoAR ?? null,
      resultadoDR: resumoFinal?.resultadoDR ?? null,
    })
  }

  return analises.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAdminReport(id: number): AdminReportRow | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM admin_reports WHERE id = ?')
  return (stmt.get(id) as AdminReportRow) ?? null
}

// ─── Cache de relatório já parseado ────────────────────────────────────────
//
// `report_json` chega a 30+MB por relatório. Trocar de ano relia em `overlayARComBaseline` +
// `enrichReportComDadosReais`, que juntos liam e faziam JSON.parse de até ~9 relatórios inteiros
// (o pedido + o ano-base + todos os irmãos do mesmo lote) A CADA requisição — era a causa
// principal do delay grande ao trocar de ano. `report_json` só muda quando esse `id` específico
// é reimportado (upsert em `saveAdminReport`), então cachear o objeto já parseado em memória (por
// id, com LRU simples) evita reler/reparsear o mesmo relatório repetidamente entre trocas de ano
// consecutivas — só o primeiro acesso a cada relatório paga o custo de parse.
//
// Cap baixo de propósito (poucas dezenas de MB por entrada já parseada) pra não estourar memória
// do processo com várias empresas grandes navegadas na mesma sessão do servidor — existe uma
// segunda cache (computedReportCache, abaixo) com seu próprio cap, então o total combinado
// importa pro orçamento de memória do processo.
const REPORT_CACHE_MAX = 16
const parsedReportCache = new Map<number, AdminReportV2>()

function invalidateParsedReportCache(id: number): void {
  parsedReportCache.delete(id)
}

// ─── Cache de relatório já computado (AR travado + overlay de dados reais) ──
//
// Mesmo com `report_json` já parseado em cache, `overlayARComBaseline`/`enrichReportComDadosReais`
// ainda recalculam simulador/DRE produto/margem/overlay de anos-irmãos do zero a cada leitura —
// caro o suficiente pra ainda segurar a troca de ano por alguns segundos. Como esse resultado só
// muda quando o próprio relatório OU algum irmão do mesmo lote é reimportado (`saveAdminReport`
// invalida certo), cachear o resultado final por id faz a segunda visita a um ano já visto (por
// qualquer usuário, não só a mesma sessão) ser quase instantânea.
const COMPUTED_CACHE_MAX = 16
const computedReportCache = new Map<number, AdminReportV2>()

export function getComputedReportCache(id: number): AdminReportV2 | undefined {
  const cached = computedReportCache.get(id)
  if (cached) {
    computedReportCache.delete(id)
    computedReportCache.set(id, cached)
  }
  return cached
}

export function setComputedReportCache(id: number, value: AdminReportV2): void {
  computedReportCache.set(id, value)
  if (computedReportCache.size > COMPUTED_CACHE_MAX) {
    const oldest = computedReportCache.keys().next().value
    if (oldest !== undefined) computedReportCache.delete(oldest)
  }
}

function invalidateComputedReportCache(id: number): void {
  computedReportCache.delete(id)
}

/** Mesma leitura de `getAdminReport`, mas com o `report_json` já parseado e cacheado em memória
 *  por id (ver comentário acima) — usar esta função em vez de `JSON.parse(getAdminReport(id)!.report_json)`
 *  em qualquer código "quente" (chamado a cada visualização/troca de ano). */
export function getAdminReportParsed(id: number): AdminReportV2 | null {
  const cached = parsedReportCache.get(id)
  if (cached) {
    // Reinsere no fim do Map (ordem de inserção = ordem de "usado por último") pra LRU simples.
    parsedReportCache.delete(id)
    parsedReportCache.set(id, cached)
    return cached
  }
  const row = getAdminReport(id)
  if (!row) return null
  const parsed = JSON.parse(row.report_json) as AdminReportV2
  parsedReportCache.set(id, parsed)
  if (parsedReportCache.size > REPORT_CACHE_MAX) {
    const oldest = parsedReportCache.keys().next().value
    if (oldest !== undefined) parsedReportCache.delete(oldest)
  }
  return parsed
}

export function generateShareToken(id: number): string {
  const token = crypto.randomUUID().replace(/-/g, '')
  const db = getDb()
  db.prepare('UPDATE admin_reports SET share_token = ? WHERE id = ?').run(token, id)
  return token
}

export function getReportByToken(token: string): AdminReportRow | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM admin_reports WHERE share_token = ?')
  return (stmt.get(token) as AdminReportRow) ?? null
}

/** Logo (data URL) da empresa vinculada ao relatório — usado no fundo ambiente das telas de cliente. */
export function getEmpresaLogoForReport(reportId: number): string | null {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT e.logo FROM admin_reports r
    JOIN empresas e ON e.id = r.empresa_id
    WHERE r.id = ?
  `)
  const row = stmt.get(reportId) as { logo: string | null } | undefined
  return row?.logo ?? null
}

export function deleteAdminReport(id: number): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM admin_reports WHERE id = ?')
  const result = stmt.run(id)
  return (result.changes as number) > 0
}

export function getReportsByPeriodRange(months: number): Omit<AdminReportRow, 'report_json'>[] {
  const db = getDb()
  const periodoInicio = new Date()
  periodoInicio.setMonth(periodoInicio.getMonth() - months)
  const inicio = periodoInicio.toISOString().slice(0, 7)

  const stmt = db.prepare(
    'SELECT id, empresa, cnpj, regime, periodo, created_at FROM admin_reports WHERE periodo >= ? ORDER BY periodo ASC'
  )
  return stmt.all(inicio) as Omit<AdminReportRow, 'report_json'>[]
}

// ─── Cache de nomes de CNPJ (consulta pública, evita repetir a busca) ─────────

/** Busca em lote os CNPJs já cacheados. Retorna só os encontrados (nome pode ser null = já tentou, sem nome). */
export function getCachedCnpjNomes(cnpjs: string[]): Map<string, string | null> {
  const result = new Map<string, string | null>()
  if (cnpjs.length === 0) return result
  const db = getDb()
  const placeholders = cnpjs.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT cnpj, nome FROM cnpj_cache WHERE cnpj IN (${placeholders})`)
  const rows = stmt.all(...cnpjs) as { cnpj: string; nome: string | null }[]
  for (const row of rows) result.set(row.cnpj, row.nome)
  return result
}

export function setCachedCnpjNome(cnpj: string, nome: string | null): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO cnpj_cache (cnpj, nome, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(cnpj) DO UPDATE SET nome = excluded.nome, fetched_at = excluded.fetched_at`
  ).run(cnpj, nome)
}

// ─── Relatórios enviados ao cliente ─────────────────────────────────────────

export function markReportSentToClient(id: number): void {
  const db = getDb()
  db.prepare("UPDATE admin_reports SET visible_to_client = 1, sent_at = datetime('now') WHERE id = ?").run(id)
}

/**
 * "Enviar pro cliente" é uma ação sobre a análise inteira (os 8 anos do mesmo lote), não só
 * sobre o ano que está aberto no admin no momento — senão o cliente só enxerga o ano em que o
 * admin clicou "Enviar", e o seletor de ano dele fica com 1 opção só. Sem lote (relatório salvo
 * antes dessa feature existir), cai pro comportamento antigo de marcar só esse id.
 */
export function markAnaliseSentToClient(empresaId: number, lote: string | null, fallbackId: number): void {
  if (!lote) { markReportSentToClient(fallbackId); return }
  const db = getDb()
  db.prepare(
    `UPDATE admin_reports SET visible_to_client = 1, sent_at = COALESCE(sent_at, datetime('now'))
     WHERE empresa_id = ? AND lote = ?`,
  ).run(empresaId, lote)
}

export function listVisibleReportsForEmpresa(empresaId: number): Omit<AdminReportRow, 'report_json'>[] {
  const db = getDb()
  const stmt = db.prepare(
    `SELECT id, empresa, cnpj, regime, periodo, created_at, empresa_id, visible_to_client, sent_at, lote
     FROM admin_reports WHERE empresa_id = ? AND visible_to_client = 1 ORDER BY periodo ASC, created_at ASC`,
  )
  return stmt.all(empresaId) as Omit<AdminReportRow, 'report_json'>[]
}

export interface ClientAnaliseItem {
  /** Id do relatório do ano-base (2026) da análise — é pra ele que o card do dashboard aponta. */
  id: number
  periodo: string
  created_at: string
  sent_at: string | null
}

/**
 * Lista de análises pro dashboard do cliente — 1 card por `lote` (os 8 anos da transição
 * importados juntos), não 1 por ano. Igual a `getEmpresaAnalises`, mas restrito aos relatórios
 * já enviados ao cliente (`visible_to_client`) e devolvendo só o id do ano-base, que é o que o
 * card precisa pra abrir o relatório direto em 2026 — os demais anos ficam disponíveis só pelo
 * seletor de ano dentro do relatório (ver ReportDashboard / `/api/client/empresas/[id]/anos`).
 */
export function listVisibleAnalisesForEmpresa(empresaId: number): ClientAnaliseItem[] {
  const rows = listVisibleReportsForEmpresa(empresaId)
  const grupos = new Map<string, typeof rows>()
  for (const r of rows) {
    const chave = r.lote ?? `legacy:${r.periodo}:${r.id}`
    const grupo = grupos.get(chave) ?? []
    grupo.push(r)
    grupos.set(chave, grupo)
  }

  const analises: ClientAnaliseItem[] = []
  for (const grupo of grupos.values()) {
    const base = grupo.reduce((min, r) => (anoDoPeriodo(r.periodo) < anoDoPeriodo(min.periodo) ? r : min))
    analises.push({
      id: base.id,
      periodo: base.periodo,
      created_at: grupo.map(r => r.created_at).sort().at(-1)!,
      sent_at: base.sent_at,
    })
  }
  return analises.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getVisibleReportForUser(reportId: number, appUserId: number): AdminReportRow | null {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT r.* FROM admin_reports r
    JOIN empresas e ON e.id = r.empresa_id
    WHERE r.id = ? AND e.app_user_id = ? AND r.visible_to_client = 1
  `)
  return (stmt.get(reportId, appUserId) as AdminReportRow) ?? null
}

// ─── Comentários por relatório ──────────────────────────────────────────────

export interface ReportCommentRow {
  id: number
  report_id: number
  author_type: 'admin' | 'cliente'
  author_user_id: number | null
  author_label: string | null
  section: string | null
  body: string
  created_at: string
}

export function listReportComments(reportId: number): ReportCommentRow[] {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM report_comments WHERE report_id = ? ORDER BY created_at ASC')
  return stmt.all(reportId) as ReportCommentRow[]
}

export function insertReportComment(data: {
  reportId: number
  authorType: 'admin' | 'cliente'
  authorUserId?: number | null
  authorLabel?: string | null
  section?: string | null
  body: string
}): ReportCommentRow {
  const db = getDb()
  const info = db
    .prepare(
      'INSERT INTO report_comments (report_id, author_type, author_user_id, author_label, section, body) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(data.reportId, data.authorType, data.authorUserId ?? null, data.authorLabel ?? null, data.section ?? null, data.body)
  return db.prepare('SELECT * FROM report_comments WHERE id = ?').get(Number(info.lastInsertRowid)) as ReportCommentRow
}

// ─── Leads do diagnóstico gratuito ──────────────────────────────────────────

export interface DiagnosticLeadRow {
  id: number
  nome: string | null
  email: string | null
  telefone: string | null
  setor: string
  regime_atual: string
  faturamento_anual: number
  margem_lucro: number | null
  resultado_json: string
  created_at: string
}

export function createDiagnosticLead(data: {
  nome?: string | null
  email?: string | null
  telefone?: string | null
  setor: string
  regimeAtual: string
  faturamentoAnual: number
  margemLucro?: number | null
  resultado: unknown
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO diagnostic_leads (nome, email, telefone, setor, regime_atual, faturamento_anual, margem_lucro, resultado_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.nome ?? null,
    data.email ?? null,
    data.telefone ?? null,
    data.setor,
    data.regimeAtual,
    data.faturamentoAnual,
    data.margemLucro ?? null,
    JSON.stringify(data.resultado),
  )
  return result.lastInsertRowid as number
}

export function listDiagnosticLeads(): DiagnosticLeadRow[] {
  const db = getDb()
  return db.prepare('SELECT * FROM diagnostic_leads ORDER BY created_at DESC').all() as DiagnosticLeadRow[]
}

// ─── Overrides de categoria mercadológica por NCM ────────────────────────────
// Correção manual da sugestão automática (lib/merc-classifier.ts) — persiste por NCM
// (não por empresa), então uma correção vale pra qualquer relatório futuro que contenha o mesmo NCM.

export interface NcmCategoriaOverrideRow {
  ncm: string
  categoria_codigo: string
  updated_at: string
}

/** Todos os overrides, como um mapa NCM → código da categoria — pronto pra passar pro admin-engine. */
export function getNcmCategoriaOverrides(): Record<string, string> {
  const db = getDb()
  const rows = db.prepare('SELECT ncm, categoria_codigo FROM ncm_categoria_overrides').all() as NcmCategoriaOverrideRow[]
  const map: Record<string, string> = {}
  for (const r of rows) map[r.ncm] = r.categoria_codigo
  return map
}

export function setNcmCategoriaOverride(ncm: string, categoriaCodigo: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO ncm_categoria_overrides (ncm, categoria_codigo, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(ncm) DO UPDATE SET categoria_codigo = excluded.categoria_codigo, updated_at = excluded.updated_at
  `).run(ncm, categoriaCodigo)
}

export function deleteNcmCategoriaOverride(ncm: string): void {
  const db = getDb()
  db.prepare('DELETE FROM ncm_categoria_overrides WHERE ncm = ?').run(ncm)
}

// ─── Classificação mercadológica conhecida por empresa (codigo_produto → Cod Familia) ──
//
// Populada a partir de uma planilha mercadológica real (parseMercadologicaClassificacao)
// no momento em que ela é enviada. Nos anos seguintes da mesma empresa, se o usuário não
// reenviar a planilha, o import reaproveita esse cache em vez de cair no palpite por texto
// — evita reprocessar/reexigir o mesmo arquivo pra cada um dos 8 anos.

interface ProdutoCategoriaCacheRow { codigo_produto: string; categoria_codigo: string }

export function getProdutoCategoriaCache(empresaId: number): Record<string, string> {
  const db = getDb()
  const rows = db.prepare(
    'SELECT codigo_produto, categoria_codigo FROM produto_categoria_cache WHERE empresa_id = ?',
  ).all(empresaId) as ProdutoCategoriaCacheRow[]
  const map: Record<string, string> = {}
  for (const r of rows) map[r.codigo_produto] = r.categoria_codigo
  return map
}

export function countProdutoCategoriaCache(empresaId: number): number {
  const db = getDb()
  const row = db.prepare(
    'SELECT COUNT(*) AS n FROM produto_categoria_cache WHERE empresa_id = ?',
  ).get(empresaId) as { n: number }
  return row.n
}

export function setProdutoCategoriaCache(empresaId: number, mapa: Record<string, string>): void {
  const entries = Object.entries(mapa)
  if (!entries.length) return
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO produto_categoria_cache (empresa_id, codigo_produto, categoria_codigo, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(empresa_id, codigo_produto) DO UPDATE SET categoria_codigo = excluded.categoria_codigo, updated_at = excluded.updated_at
  `)
  for (const [codigoProduto, categoriaCodigo] of entries) stmt.run(empresaId, codigoProduto, categoriaCodigo)
}

// ─── Textos editáveis do dashboard, por empresa ─────────────────────────────

interface DashboardTextoRow { chave: string; valor: string }

/** Overrides de texto salvos por essa empresa — chave → valor. Chaves sem override
 *  aqui simplesmente não aparecem no mapa, e o dashboard usa o texto padrão. */
export function getDashboardTextos(empresaId: number): Record<string, string> {
  const db = getDb()
  const rows = db.prepare('SELECT chave, valor FROM dashboard_textos WHERE empresa_id = ?').all(empresaId) as DashboardTextoRow[]
  const map: Record<string, string> = {}
  for (const r of rows) map[r.chave] = r.valor
  return map
}

export function setDashboardTexto(empresaId: number, chave: string, valor: string): void {
  const db = getDb()
  if (!valor.trim()) {
    db.prepare('DELETE FROM dashboard_textos WHERE empresa_id = ? AND chave = ?').run(empresaId, chave)
    return
  }
  db.prepare(`
    INSERT INTO dashboard_textos (empresa_id, chave, valor, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(empresa_id, chave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at
  `).run(empresaId, chave, valor)
}

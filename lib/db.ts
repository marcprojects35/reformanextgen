import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export type Setor =
  | 'comercio'
  | 'industria'
  | 'servicos'
  | 'servicos_fator_r'
  | 'agropecuaria'

export type RegimeAtual = 'simples' | 'presumido' | 'real'

export type SimulationStatus = 'rascunho' | 'processando' | 'concluida' | 'erro'

export type DocumentType = 'xml' | 'efd' | 'xlsx' | 'json'

export type Operacao = 'entrada' | 'saida'

export interface UserRow {
  id: number
  name: string
  email: string
  phone: string | null
  uf: string | null
  business_area: string | null
  password_hash: string
  password_salt: string
  created_at: string
}

export interface CompanyRow {
  id: number
  user_id: number
  cnpj: string | null
  razao_social: string
  setor: Setor
  uf: string
  regime_atual: RegimeAtual
  faturamento_anual: number
  margem_lucro: number
  admin_empresa_id: number | null
  logo: string | null
  created_at: string
}

export interface SimulationRow {
  id: number
  company_id: number
  status: SimulationStatus
  error_message: string | null
  created_at: string
}

export interface DocumentRow {
  id: number
  simulation_id: number
  filename: string
  type: DocumentType
  uploaded_at: string
}

export interface LineItemRow {
  id: number
  simulation_id: number
  source_document_id: number | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  descricao: string | null
  operacao: Operacao
  valor: number
  cliente_fornecedor: string | null
}

export interface ResultRow {
  id: number
  simulation_id: number
  regime: string
  ano: number
  receita: number
  tributos_atuais: number
  tributos_reforma: number
  carga_atual_pct: number
  carga_reforma_pct: number
  payload_json: string | null
}

export interface NotificationRow {
  id: number
  user_id: number
  type: string
  title: string
  body: string | null
  link: string | null
  report_id: number | null
  read_at: string | null
  created_at: string
}

export interface CompanyEditChange {
  field: string
  label: string
  before: unknown
  after: unknown
}

export interface CompanyEditRow {
  id: number
  company_id: number
  user_id: number
  motivo: string
  changes_json: string
  created_at: string
}

export interface CompanyEditWithUser extends CompanyEditRow {
  user_name: string
}

let instance: DatabaseSync | null = null

function createSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      uf TEXT,
      business_area TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      cnpj TEXT,
      razao_social TEXT NOT NULL,
      setor TEXT NOT NULL,
      uf TEXT NOT NULL,
      regime_atual TEXT NOT NULL,
      faturamento_anual REAL NOT NULL,
      margem_lucro REAL NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      status TEXT NOT NULL DEFAULT 'rascunho',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL REFERENCES simulations(id),
      filename TEXT NOT NULL,
      type TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL REFERENCES simulations(id),
      source_document_id INTEGER REFERENCES documents(id),
      ncm TEXT,
      cfop TEXT,
      cst TEXT,
      descricao TEXT,
      operacao TEXT NOT NULL,
      valor REAL NOT NULL,
      cliente_fornecedor TEXT
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL REFERENCES simulations(id),
      regime TEXT NOT NULL,
      ano INTEGER NOT NULL,
      receita REAL NOT NULL,
      tributos_atuais REAL NOT NULL,
      tributos_reforma REAL NOT NULL,
      carga_atual_pct REAL NOT NULL,
      carga_reforma_pct REAL NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      report_id INTEGER,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      motivo TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
    CREATE INDEX IF NOT EXISTS idx_simulations_company ON simulations(company_id);
    CREATE INDEX IF NOT EXISTS idx_documents_simulation ON documents(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_line_items_simulation ON line_items(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_results_simulation ON results(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_company_edits_company ON company_edits(company_id);
  `)
}

/* Aplica migrações aditivas para DBs criados antes de um campo existir.
   ALTER TABLE ADD COLUMN lança erro se a coluna já existe — ignoramos. */
function migrateSchema(db: DatabaseSync) {
  const migrations = [
    'ALTER TABLE users ADD COLUMN phone TEXT',
    'ALTER TABLE users ADD COLUMN uf TEXT',
    'ALTER TABLE users ADD COLUMN business_area TEXT',
    'ALTER TABLE companies ADD COLUMN admin_empresa_id INTEGER',
    'ALTER TABLE companies ADD COLUMN logo TEXT',
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* coluna já existe */ }
  }
}

// node:sqlite retorna linhas como objetos com prototype nulo, que o React
// rejeita ao passar de Server Component para Client Component. Copiamos
// para um objeto plano aqui, uma única vez, em vez de em cada call site.
function toRow<T extends object>(value: unknown): T | undefined {
  return value === undefined ? undefined : ({ ...(value as object) } as T)
}

function toRows<T extends object>(values: unknown[]): T[] {
  return values.map((value) => ({ ...(value as object) }) as T)
}

export function getDb(): DatabaseSync {
  if (instance) return instance

  const dataDir = path.join(process.cwd(), 'data')
  mkdirSync(dataDir, { recursive: true })

  const db = new DatabaseSync(path.join(dataDir, 'app.db'))
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  createSchema(db)
  migrateSchema(db)

  instance = db
  return db
}

// --- users ---

export function createUser(input: {
  name: string
  email: string
  phone?: string | null
  uf?: string | null
  businessArea?: string | null
  passwordHash: string
  passwordSalt: string
}): UserRow {
  const db = getDb()
  const info = db
    .prepare(
      'INSERT INTO users (name, email, phone, uf, business_area, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      input.name,
      input.email.toLowerCase(),
      input.phone ?? null,
      input.uf ?? null,
      input.businessArea ?? null,
      input.passwordHash,
      input.passwordSalt,
    )
  return getUserById(Number(info.lastInsertRowid))!
}

export function getUserByEmail(email: string): UserRow | undefined {
  return toRow<UserRow>(
    getDb()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase()),
  )
}

export function getUserById(id: number): UserRow | undefined {
  return toRow<UserRow>(getDb().prepare('SELECT * FROM users WHERE id = ?').get(id))
}

export function updateUser(
  id: number,
  fields: {
    name?: string
    phone?: string | null
    uf?: string | null
    businessArea?: string | null
    passwordHash?: string
    passwordSalt?: string
  },
) {
  const sets: string[] = []
  const values: unknown[] = []
  if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name) }
  if (fields.phone !== undefined) { sets.push('phone = ?'); values.push(fields.phone) }
  if (fields.uf !== undefined) { sets.push('uf = ?'); values.push(fields.uf) }
  if (fields.businessArea !== undefined) { sets.push('business_area = ?'); values.push(fields.businessArea) }
  if (fields.passwordHash !== undefined) { sets.push('password_hash = ?'); values.push(fields.passwordHash) }
  if (fields.passwordSalt !== undefined) { sets.push('password_salt = ?'); values.push(fields.passwordSalt) }
  if (sets.length === 0) return
  values.push(id)
  getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

// --- companies ---

export function createCompany(input: {
  userId: number
  cnpj: string | null
  razaoSocial: string
  setor: Setor
  uf: string
  regimeAtual: RegimeAtual
  faturamentoAnual: number
  margemLucro: number
}): CompanyRow {
  const db = getDb()
  const info = db
    .prepare(
      `INSERT INTO companies
        (user_id, cnpj, razao_social, setor, uf, regime_atual, faturamento_anual, margem_lucro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.cnpj,
      input.razaoSocial,
      input.setor,
      input.uf,
      input.regimeAtual,
      input.faturamentoAnual,
      input.margemLucro,
    )
  return getCompanyById(Number(info.lastInsertRowid))!
}

export function getCompanyById(id: number): CompanyRow | undefined {
  return toRow<CompanyRow>(
    getDb().prepare('SELECT * FROM companies WHERE id = ?').get(id),
  )
}

export function listCompaniesByUser(userId: number): CompanyRow[] {
  return toRows<CompanyRow>(
    getDb()
      .prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId),
  )
}

export function setCompanyAdminEmpresaId(companyId: number, empresaId: number) {
  getDb()
    .prepare('UPDATE companies SET admin_empresa_id = ? WHERE id = ?')
    .run(empresaId, companyId)
}

export function updateCompany(
  id: number,
  fields: Partial<{
    razaoSocial: string
    cnpj: string | null
    setor: Setor
    uf: string
    regimeAtual: RegimeAtual
    faturamentoAnual: number
    margemLucro: number
    logo: string | null
  }>,
) {
  const colMap: Record<string, string> = {
    razaoSocial: 'razao_social',
    cnpj: 'cnpj',
    setor: 'setor',
    uf: 'uf',
    regimeAtual: 'regime_atual',
    faturamentoAnual: 'faturamento_anual',
    margemLucro: 'margem_lucro',
    logo: 'logo',
  }
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      sets.push(`${col} = ?`)
      values.push((fields as Record<string, unknown>)[key])
    }
  }
  if (sets.length === 0) return
  values.push(id)
  getDb().prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

// --- company edit history ---

export function insertCompanyEdit(input: {
  companyId: number
  userId: number
  motivo: string
  changes: CompanyEditChange[]
}): void {
  getDb()
    .prepare('INSERT INTO company_edits (company_id, user_id, motivo, changes_json) VALUES (?, ?, ?, ?)')
    .run(input.companyId, input.userId, input.motivo, JSON.stringify(input.changes))
}

export function listCompanyEditsWithUser(companyId: number): CompanyEditWithUser[] {
  return toRows<CompanyEditWithUser>(
    getDb()
      .prepare(
        `SELECT ce.*, u.name as user_name
         FROM company_edits ce
         JOIN users u ON u.id = ce.user_id
         WHERE ce.company_id = ?
         ORDER BY ce.created_at DESC`,
      )
      .all(companyId),
  )
}

// --- simulations ---

export function createSimulation(companyId: number): SimulationRow {
  const db = getDb()
  const info = db
    .prepare("INSERT INTO simulations (company_id, status) VALUES (?, 'rascunho')")
    .run(companyId)
  return getSimulationById(Number(info.lastInsertRowid))!
}

export function getSimulationById(id: number): SimulationRow | undefined {
  return toRow<SimulationRow>(
    getDb().prepare('SELECT * FROM simulations WHERE id = ?').get(id),
  )
}

export function updateSimulationStatus(
  id: number,
  status: SimulationStatus,
  errorMessage?: string | null,
) {
  getDb()
    .prepare('UPDATE simulations SET status = ?, error_message = ? WHERE id = ?')
    .run(status, errorMessage ?? null, id)
}

export interface SimulationWithCompany extends SimulationRow {
  razao_social: string
  setor: Setor
  uf: string
  regime_atual: RegimeAtual
  faturamento_anual: number
  margem_lucro: number
}

export function listSimulationsByUser(userId: number): SimulationWithCompany[] {
  return toRows<SimulationWithCompany>(
    getDb()
      .prepare(
        `SELECT s.*, c.razao_social, c.setor, c.uf, c.regime_atual, c.faturamento_anual, c.margem_lucro
         FROM simulations s
         JOIN companies c ON c.id = s.company_id
         WHERE c.user_id = ?
         ORDER BY s.created_at DESC`,
      )
      .all(userId),
  )
}

export function getSimulationWithCompany(
  simulationId: number,
  userId: number,
): SimulationWithCompany | undefined {
  return toRow<SimulationWithCompany>(
    getDb()
      .prepare(
        `SELECT s.*, c.razao_social, c.setor, c.uf, c.regime_atual, c.faturamento_anual, c.margem_lucro
         FROM simulations s
         JOIN companies c ON c.id = s.company_id
         WHERE s.id = ? AND c.user_id = ?`,
      )
      .get(simulationId, userId),
  )
}

// --- documents ---

export function insertDocument(input: {
  simulationId: number
  filename: string
  type: DocumentType
}): DocumentRow {
  const db = getDb()
  const info = db
    .prepare(
      'INSERT INTO documents (simulation_id, filename, type) VALUES (?, ?, ?)',
    )
    .run(input.simulationId, input.filename, input.type)
  return toRow<DocumentRow>(
    db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(info.lastInsertRowid)),
  )!
}

// --- line items ---

export function insertLineItems(
  simulationId: number,
  sourceDocumentId: number,
  items: Array<{
    ncm: string | null
    cfop: string | null
    cst: string | null
    descricao: string | null
    operacao: Operacao
    valor: number
    clienteFornecedor: string | null
  }>,
) {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO line_items
      (simulation_id, source_document_id, ncm, cfop, cst, descricao, operacao, valor, cliente_fornecedor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const item of items) {
    stmt.run(
      simulationId,
      sourceDocumentId,
      item.ncm,
      item.cfop,
      item.cst,
      item.descricao,
      item.operacao,
      item.valor,
      item.clienteFornecedor,
    )
  }
}

export function listDocuments(simulationId: number): DocumentRow[] {
  return toRows<DocumentRow>(
    getDb()
      .prepare('SELECT * FROM documents WHERE simulation_id = ? ORDER BY uploaded_at')
      .all(simulationId),
  )
}

export function getLineItems(simulationId: number): LineItemRow[] {
  return toRows<LineItemRow>(
    getDb()
      .prepare('SELECT * FROM line_items WHERE simulation_id = ?')
      .all(simulationId),
  )
}

export function countLineItems(simulationId: number): number {
  const result = getDb()
    .prepare('SELECT COUNT(*) as count FROM line_items WHERE simulation_id = ?')
    .get(simulationId) as { count: number }
  return result.count
}

// --- results ---

export function replaceResults(
  simulationId: number,
  rows: Array<{
    regime: string
    ano: number
    receita: number
    tributosAtuais: number
    tributosReforma: number
    cargaAtualPct: number
    cargaReformaPct: number
    payload?: unknown
  }>,
) {
  const db = getDb()
  db.prepare('DELETE FROM results WHERE simulation_id = ?').run(simulationId)
  const stmt = db.prepare(
    `INSERT INTO results
      (simulation_id, regime, ano, receita, tributos_atuais, tributos_reforma, carga_atual_pct, carga_reforma_pct, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const row of rows) {
    stmt.run(
      simulationId,
      row.regime,
      row.ano,
      row.receita,
      row.tributosAtuais,
      row.tributosReforma,
      row.cargaAtualPct,
      row.cargaReformaPct,
      row.payload ? JSON.stringify(row.payload) : null,
    )
  }
}

export function getResults(simulationId: number): ResultRow[] {
  return toRows<ResultRow>(
    getDb()
      .prepare('SELECT * FROM results WHERE simulation_id = ? ORDER BY regime, ano')
      .all(simulationId),
  )
}

export function deleteSimulation(simulationId: number) {
  const db = getDb()
  db.prepare('DELETE FROM results WHERE simulation_id = ?').run(simulationId)
  db.prepare('DELETE FROM line_items WHERE simulation_id = ?').run(simulationId)
  db.prepare('DELETE FROM documents WHERE simulation_id = ?').run(simulationId)
  db.prepare('DELETE FROM simulations WHERE id = ?').run(simulationId)
}

// --- notifications ---

export function createNotification(input: {
  userId: number
  type: string
  title: string
  body?: string | null
  link?: string | null
  reportId?: number | null
}): NotificationRow {
  const db = getDb()
  const info = db
    .prepare(
      'INSERT INTO notifications (user_id, type, title, body, link, report_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      input.link ?? null,
      input.reportId ?? null,
    )
  return toRow<NotificationRow>(
    db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(info.lastInsertRowid)),
  )!
}

export function listNotificationsByUser(userId: number, opts?: { onlyUnread?: boolean }): NotificationRow[] {
  const where = opts?.onlyUnread ? 'AND read_at IS NULL' : ''
  return toRows<NotificationRow>(
    getDb()
      .prepare(`SELECT * FROM notifications WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT 50`)
      .all(userId),
  )
}

export function countUnreadNotifications(userId: number): number {
  const result = getDb()
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId) as { count: number }
  return result.count
}

export function markNotificationRead(id: number, userId: number) {
  getDb()
    .prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL")
    .run(id, userId)
}

export function markAllNotificationsRead(userId: number) {
  getDb()
    .prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL")
    .run(userId)
}

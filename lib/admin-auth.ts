import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ADMIN_COOKIE = 'admin_session'
const ADMIN_MAX_AGE = 60 * 60 * 8 // 8 horas

function getSecret(): string {
  return process.env.SESSION_SECRET ?? 'admin-dev-secret'
}

function getAdminUser(): string {
  return process.env.ADMIN_USER ?? 'admin'
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? 'admin'
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ admin: true, exp: Date.now() + ADMIN_MAX_AGE * 1000 }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyAdminToken(token: string): boolean {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  if (sign(payload) !== sig) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.admin === true && Date.now() < data.exp
  } catch {
    return false
  }
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const expectedUser = getAdminUser()
  const expectedPass = getAdminPassword()
  const userOk =
    username.length === expectedUser.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser))
  const passOk =
    password.length === expectedPass.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass))
  return userOk && passOk
}

export async function setAdminCookie() {
  const store = await cookies()
  store.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_MAX_AGE,
  })
}

export async function clearAdminCookie() {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (!token) return false
  return verifyAdminToken(token)
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) {
    redirect('/admin')
  }
}

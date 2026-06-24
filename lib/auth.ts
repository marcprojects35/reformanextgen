import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUserById, type UserRow } from '@/lib/db'

const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 dias

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET não configurado. Defina a variável de ambiente em .env.local.',
    )
  }
  return secret
}

export function hashPassword(password: string): {
  hash: string
  salt: string
} {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  const hash = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, 'hex')
  if (hash.length !== expected.length) return false
  return timingSafeEqual(hash, expected)
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function createSessionToken(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifySessionToken(token: string): { userId: number } | null {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  if (sign(payload) !== signature) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId: number
      exp: number
    }
    if (Date.now() > data.exp) return null
    return { userId: data.userId }
  } catch {
    return null
  }
}

export async function setSessionCookie(userId: number) {
  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export type PublicUser = Omit<UserRow, 'password_hash' | 'password_salt'>

function toPublicUser(user: UserRow): PublicUser {
  const { password_hash, password_salt, ...publicUser } = user
  return publicUser
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = verifySessionToken(token)
  if (!session) return null

  const user = getUserById(session.userId)
  if (!user) return null

  return toPublicUser(user)
}

export async function requireUser(nextPath?: string): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
    redirect(`/login${query}`)
  }
  return user
}

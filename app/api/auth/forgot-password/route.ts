import { NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db'

/**
 * Sempre responde 200 para não vazar quais e-mails estão cadastrados.
 * Quando integrar um serviço de e-mail (Resend, SendGrid etc.), substituir
 * o console.log pelo envio real do link com token de reset.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  const user = getUserByEmail(email)

  if (user) {
    // TODO: gerar token seguro, salvar no banco com expiração e enviar por e-mail.
    // Por enquanto apenas loga no servidor para facilitar o desenvolvimento.
    console.log(`[forgot-password] Reset solicitado para: ${email} (user #${user.id})`)
  }

  // Responde 200 independente de o e-mail existir (evita user enumeration).
  return NextResponse.json({ ok: true })
}

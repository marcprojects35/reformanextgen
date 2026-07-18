import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const COMPRESS_MIN_BYTES = 8192
// Qualidade 4 comprime esse JSON ~25% melhor que gzip E mais rápido que gzip nesse tamanho de
// payload (testado com relatório real de 32MB: brotli q4 523ms/3.65MB vs gzip 716ms/4.84MB) —
// qualidades mais altas (padrão do brotli é 11) ficam ordens de magnitude mais lentas sem ganho
// proporcional pra JSON com muito número repetido.
const BROTLI_QUALITY = 4

/**
 * Relatórios de empresas grandes (milhares de NCMs × 8 anos de projeção) chegam a 30+MB em JSON.
 * `next start` não comprime respostas de route handlers streamadas — sem isso, esse payload vira
 * o gargalo real ao trocar de ano num link de rede mais lento (rede local/Wi-Fi), não o parse/cálculo
 * no servidor. Compacta manualmente com o melhor codec que o cliente aceitar.
 */
export function jsonResponse(data: unknown, request: Request, init?: ResponseInit): Response {
  const body = JSON.stringify(data)
  const acceptEncoding = request.headers.get('accept-encoding') ?? ''
  const headers = new Headers(init?.headers)
  headers.set('content-type', 'application/json')

  if (body.length > COMPRESS_MIN_BYTES) {
    if (acceptEncoding.includes('br')) {
      headers.set('content-encoding', 'br')
      const compressed = brotliCompressSync(body, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      })
      return new Response(compressed, { ...init, headers })
    }
    if (acceptEncoding.includes('gzip')) {
      headers.set('content-encoding', 'gzip')
      return new Response(gzipSync(body), { ...init, headers })
    }
  }
  return new Response(body, { ...init, headers })
}

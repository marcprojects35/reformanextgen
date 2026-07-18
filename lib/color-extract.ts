/** Extração de paleta dominante de uma imagem (logo) no browser, via canvas. */

interface Bucket { count: number; r: number; g: number; b: number }

/**
 * Realça saturação/luminância da cor extraída, preservando o matiz (hue) original.
 * Muitos logos reais são ilustrações com cores naturalmente dessaturadas (tons de pele,
 * marrom, cinza) — sem isso o glow ambiente fica quase invisível sobre o fundo escuro.
 */
function vividize(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  const d = max - min
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }

  const s = 0.62
  const lFinal = Math.min(Math.max(l, 0.5), 0.62)

  const c = (1 - Math.abs(2 * lFinal - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lFinal - c / 2
  let [r1, g1, b1] = [0, 0, 0]
  if (h < 60) [r1, g1, b1] = [c, x, 0]
  else if (h < 120) [r1, g1, b1] = [x, c, 0]
  else if (h < 180) [r1, g1, b1] = [0, c, x]
  else if (h < 240) [r1, g1, b1] = [0, x, c]
  else if (h < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]

  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)]
}

/**
 * Amostra a imagem num canvas pequeno e agrupa pixels em baldes de cor,
 * ignorando quase-branco/quase-preto/tons dessaturados (fundo comum de logo)
 * para priorizar as cores de marca de fato.
 */
export function extractPaletteFromImage(src: string, sampleSize = 48): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = sampleSize
        canvas.height = sampleSize
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve([]); return }

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const buckets = new Map<string, Bucket>()

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 200) continue

          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          const sat = max === 0 ? 0 : (max - min) / max
          const isNearWhite = r > 235 && g > 235 && b > 235
          const isNearBlack = r < 20 && g < 20 && b < 20
          if (isNearWhite || isNearBlack || sat < 0.12) continue

          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`
          const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
          bucket.count += 1
          bucket.r += r
          bucket.g += g
          bucket.b += b
          buckets.set(key, bucket)
        }

        const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
        const top = sorted
          .slice(0, 3)
          .map(b => vividize(b.r / b.count, b.g / b.count, b.b / b.count))
          .map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`)
        resolve(top)
      } catch {
        resolve([])
      }
    }

    img.onerror = () => resolve([])
    img.src = src
  })
}

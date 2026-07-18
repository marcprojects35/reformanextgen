/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Permite acessar o servidor de dev pelo IP da rede local (ex: deploy em
  // 192.168.0.84) sem o Next bloquear os recursos de dev (CSS/JS/HMR) por
  // origem cruzada — sem isso a página carrega só o HTML, sem estilo.
  allowedDevOrigins: ['192.168.0.84', 'localhost', '127.0.0.1'],
}

export default nextConfig
